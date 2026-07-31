import { Router } from "express";
import { prisma, getCities } from "../db.js";
import {
  wrap, badRequest, notFound, dayStart, atTime,
  fareFor, durationMinFor, estDistanceKm, HOLD_TTL_MS,
} from "../lib/util.js";
import { CITIES, CITY_COORDS } from "../data/cities.js";

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

// GET /api/trips/:id/route — full station-wise route plan with scheduled reach times.
// Intermediate stops are real Gujarat cities lying near the straight line from→to,
// each with ETA/ETD computed from the trip's own timetable (no GPS needed).
r.get("/:id/route", wrap(async (req, res) => {
  const t = await prisma.trip.findUnique({
    where: { id: Number(req.params.id) },
    include: { bus: true, route: { include: { fromCity: true, toCity: true } } },
  });
  if (!t) return notFound(res, "Trip not found");

  const km = t.route.distance_km;
  const totalMin = Math.max(20, Math.round((new Date(t.arrival_time) - new Date(t.departure_time)) / 60000));
  const A = t.route.fromCity, B = t.route.toCity;

  const vx = B.lng - A.lng, vy = B.lat - A.lat;
  const len2 = vx * vx + vy * vy || 1;
  let candidates = [];
  for (const name of CITIES) {
    if (name === A.name || name === B.name) continue;
    const [cy, cx] = CITY_COORDS[name];
    const px = cx - A.lng, py = cy - A.lat;
    const tt = (px * vx + py * vy) / len2;
    if (tt <= 0.08 || tt >= 0.92) continue;
    const perp = (Math.abs(px * vy - py * vx) / Math.sqrt(len2)) * 111;
    if (perp > Math.max(28, km * 0.2)) continue;
    candidates.push({ name, t: tt });
  }
  candidates.sort((a, b) => a.t - b.t);
  if (candidates.length > 4) {
    const step = candidates.length / 4;
    candidates = [0, 1, 2, 3].map((i) => candidates[Math.round(i * step + (step - 1) / 2)]);
  }

  // Halts: the middle stop becomes a 15-min refreshment break
  const halts = candidates.map(() => 5);
  const mealIdx = candidates.length ? Math.floor((candidates.length - 1) / 2) : -1;
  if (mealIdx >= 0) halts[mealIdx] = 15;
  const haltTotal = halts.reduce((s, h) => s + h, 0);
  const travelMin = Math.max(15, totalMin - haltTotal);

  const depMs = new Date(t.departure_time).getTime();
  const addMin = (m) => new Date(depMs + m * 60000).toISOString();

  const stops = [{ seq: 0, name: A.name, kind: "BOARDING", km: 0, arr: null, dep: t.departure_time, haltMin: 0, meal: false }];
  let haltsBefore = 0;
  candidates.forEach((c, i) => {
    const arrMin = travelMin * c.t + haltsBefore;
    haltsBefore += halts[i];
    stops.push({
      seq: i + 1, name: c.name, kind: "STOP",
      km: Math.max(1, Math.round(km * c.t)),
      arr: addMin(arrMin), dep: addMin(arrMin + halts[i]),
      haltMin: halts[i], meal: halts[i] >= 15,
    });
  });
  stops.push({ seq: stops.length, name: B.name, kind: "DROP", km: Math.round(km), arr: t.arrival_time, dep: null, haltMin: 0, meal: false });

  res.json({
    trip: { id: t.id, status: t.status, date: t.date, departure_time: t.departure_time, arrival_time: t.arrival_time, fare: t.fare },
    bus: { bus_number: t.bus.bus_number, operator_name: t.bus.operator_name, type: t.bus.type },
    route: { from: { name: A.name }, to: { name: B.name }, distance_km: km, duration_min: totalMin },
    stops,
  });
}));

// GET /api/trips/:id — seat layout, booked seats, reviews
r.get("/:id", wrap(async (req, res) => {
  const t = await prisma.trip.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      bus: { include: { seats: { orderBy: [{ deck: "asc" }, { row: "asc" }, { col: "asc" }] } } },
      route: { include: { fromCity: true, toCity: true } },
      driver: { select: { name: true } },
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
