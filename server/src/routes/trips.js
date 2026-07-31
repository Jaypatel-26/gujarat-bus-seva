import { Router } from "express";
import { prisma, getCities } from "../db.js";
import {
  wrap, badRequest, notFound, dayStart, atTime,
  fareFor, durationMinFor, estDistanceKm, HOLD_TTL_MS,
} from "../lib/util.js";

const r = Router();

async function resolveCity(idOrName) {
  const cities = await getCities();
  const s = String(idOrName);
  if (/^\d+$/.test(s)) return cities.find((c) => c.id === Number(s));
  const q = s.trim().toLowerCase();
  return cities.find((c) => c.name.toLowerCase() === q) ||
    cities.find((c) => c.name.toLowerCase().startsWith(q));
}

async function getOrCreateRoute(fromCity, toCity) {
  const where = { from_city_id_to_city_id: { from_city_id: fromCity.id, to_city_id: toCity.id } };
  let route = await prisma.route.findUnique({ where });
  if (!route) {
    const km = estDistanceKm([fromCity.lat, fromCity.lng], [toCity.lat, toCity.lng]);
    route = await prisma.route.create({
      data: { from_city_id: fromCity.id, to_city_id: toCity.id, distance_km: km, base_fare: fareFor("NON_AC_SEATER", km) },
    });
  }
  return route;
}

const SLOT_POOLS = [
  [[6, 15], [13, 0], [22, 30]],
  [[8, 0], [15, 45], [23, 15]],
  [[9, 30], [18, 30], [23, 55]],
  [[7, 0], [14, 0], [21, 45]],
];

export async function generateTripsForDay(route, day) {
  const buses = await prisma.bus.findMany();
  if (!buses.length) return;
  const drivers = await prisma.user.findMany({ where: { role: "DRIVER" } });
  const pool = SLOT_POOLS[route.id % SLOT_POOLS.length];
  for (let i = 0; i < pool.length; i++) {
    const [h, m] = pool[i];
    const bus = buses[(route.id + i * 3) % buses.length];
    const dep = atTime(day, h, m);
    const dur = durationMinFor(bus.type, route.distance_km);
    await prisma.trip.create({
      data: {
        route_id: route.id, bus_id: bus.id,
        driver_id: drivers.length ? drivers[(route.id + i) % drivers.length].id : null,
        departure_time: dep, arrival_time: new Date(dep.getTime() + dur * 60000),
        date: day, status: "SCHEDULED", fare: fareFor(bus.type, route.distance_km),
      },
    });
  }
}

// tripId -> [occupied seat ids] (confirmed, or pending-hold within 15 min)
export async function occupiedSeatMap(tripIds) {
  if (!tripIds.length) return new Map();
  const cutoff = new Date(Date.now() - HOLD_TTL_MS);
  const rows = await prisma.bookingSeat.findMany({
    where: {
      booking: {
        trip_id: { in: tripIds },
        OR: [{ status: "CONFIRMED" }, { status: "PENDING", created_at: { gt: cutoff } }],
      },
    },
    select: { seat_id: true, booking: { select: { trip_id: true } } },
  });
  const map = new Map();
  for (const row of rows) {
    const tid = row.booking.trip_id;
    if (!map.has(tid)) map.set(tid, []);
    map.get(tid).push(row.seat_id);
  }
  return map;
}

function serializeTrip(t, seatsTaken, pax) {
  const now = new Date();
  const seatsLeft = t.bus.total_seats - seatsTaken;
  const departed = t.departure_time < now;
  return {
    id: t.id, status: t.status, fare: t.fare, date: t.date,
    departureTime: t.departure_time, arrivalTime: t.arrival_time,
    durationMin: Math.round((t.arrival_time - t.departure_time) / 60000),
    seatsLeft, departed,
    bookable: t.status === "SCHEDULED" && !departed && seatsLeft >= pax,
    bus: { number: t.bus.bus_number, operator: t.bus.operator_name, type: t.bus.type },
  };
}

// GET /api/trips/search?from=1&to=3&date=2026-08-01&pax=2
r.get("/search", wrap(async (req, res) => {
  const { from, to, date } = req.query;
  const pax = Math.min(6, Math.max(1, Number(req.query.pax) || 1));
  if (!from || !to || !date) return badRequest(res, "from, to and date are required");
  const fromCity = await resolveCity(from);
  const toCity = await resolveCity(to);
  if (!fromCity || !toCity) return badRequest(res, "Unknown city");
  if (fromCity.id === toCity.id) return badRequest(res, "Origin and destination cannot be the same");

  const day = dayStart(date);
  const route = await getOrCreateRoute(fromCity, toCity);
  const tripQuery = { where: { route_id: route.id, date: day }, include: { bus: true }, orderBy: { departure_time: "asc" } };
  let trips = await prisma.trip.findMany(tripQuery);
  if (!trips.length) {
    await generateTripsForDay(route, day);
    trips = await prisma.trip.findMany(tripQuery);
  }

  const occ = await occupiedSeatMap(trips.map((t) => t.id));
  const agg = await prisma.review.aggregate({ where: { OR: [{ route_id: route.id }] }, _avg: { rating: true }, _count: true });
  res.json({
    route: { id: route.id, distanceKm: route.distance_km, from: { id: fromCity.id, name: fromCity.name }, to: { id: toCity.id, name: toCity.name } },
    rating: { avg: +(agg._avg.rating || 0).toFixed(1), count: agg._count },
    trips: trips.map((t) => serializeTrip(t, (occ.get(t.id) || []).length, pax)),
  });
}));

// GET /api/trips/popular — curated homepage routes with starting fares
r.get("/popular", wrap(async (_req, res) => {
  const pairs = [
    ["Ahmedabad", "Surat"], ["Ahmedabad", "Rajkot"], ["Ahmedabad", "Bhuj"],
    ["Surat", "Vadodara"], ["Rajkot", "Jamnagar"], ["Ahmedabad", "Somnath"],
  ];
  const out = [];
  for (const [a, b] of pairs) {
    const fromCity = await resolveCity(a), toCity = await resolveCity(b);
    if (!fromCity || !toCity) continue;
    const route = await getOrCreateRoute(fromCity, toCity);
    const cheapest = await prisma.trip.findFirst({
      where: { route_id: route.id, departure_time: { gt: new Date() } },
      orderBy: { fare: "asc" },
    });
    out.push({
      from: { id: fromCity.id, name: fromCity.name },
      to: { id: toCity.id, name: toCity.name },
      distanceKm: route.distance_km,
      fromFare: cheapest ? cheapest.fare : fareFor("NON_AC_SEATER", route.distance_km),
    });
  }
  res.json({ popular: out });
}));

// GET /api/trips/:id — seat layout, booked seats, live location, reviews
r.get("/:id", wrap(async (req, res) => {
  const t = await prisma.trip.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      bus: { include: { seats: { orderBy: [{ deck: "asc" }, { row: "asc" }, { col: "asc" }] } } },
      route: { include: { fromCity: true, toCity: true } },
      driver: { select: { name: true } },
      liveLocation: true,
    },
  });
  if (!t) return notFound(res, "Trip not found");
  const occ = await occupiedSeatMap([t.id]);
  const reviews = await prisma.review.findMany({
    where: { route_id: t.route_id },
    include: { user: { select: { name: true } } },
    orderBy: { created_at: "desc" },
    take: 6,
  });
  const agg = await prisma.review.aggregate({ where: { route_id: t.route_id }, _avg: { rating: true }, _count: true });
  res.json({
    ...t,
    bookedSeatIds: occ.get(t.id) || [],
    reviews,
    rating: { avg: +(agg._avg.rating || 0).toFixed(1), count: agg._count },
  });
}));

export default r;
