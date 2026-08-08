import { Router } from "express";
import { prisma, getCities, getPopularCache, setPopularCache } from "../db.js";
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
  const buses = await prisma.bus.findMany({ orderBy: { id: "asc" } });
  if (!buses.length) return;
  const drivers = await prisma.user.findMany({ where: { role: "DRIVER" }, orderBy: { id: "asc" } });
  const pool = SLOT_POOLS[route.id % SLOT_POOLS.length];
  // Har route ka conductor FIXED (route id se) — har din wahi, kabhi rotate nahi
  const driver = drivers.length ? drivers[route.id % drivers.length] : null;
  for (let i = 0; i < pool.length; i++) {
    const [h, m] = pool[i];
    const bus = buses[(route.id + i * 3) % buses.length];
    const dep = atTime(day, h, m);
    const dur = durationMinFor(bus.type, route.distance_km);
    await prisma.trip.create({
      data: {
        route_id: route.id, bus_id: bus.id,
        driver_id: driver ? driver.id : null,
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
// SPEED: 15-min memory cache + sirf 2 DB queries total (pehle 12+ sequential queries the!)
r.get("/popular", wrap(async (_req, res) => {
  const cached = getPopularCache(15 * 60000);
  if (cached) return res.json(cached);

  const pairs = [
    ["Ahmedabad", "Surat"], ["Ahmedabad", "Rajkot"], ["Ahmedabad", "Bhuj"],
    ["Surat", "Vadodara"], ["Rajkot", "Jamnagar"], ["Ahmedabad", "Somnath"],
  ];
  const cities = await getCities();
  const byName = new Map(cities.map((c) => [c.name, c]));

  // Query 1: saare 6 routes ek saath (missing ho to bana do — fresh DB pe pehli baar)
  const orConds = [];
  for (const [a, b] of pairs) {
    const A = byName.get(a), B = byName.get(b);
    if (A && B) orConds.push({ from_city_id: A.id, to_city_id: B.id });
  }
  const routes = await prisma.route.findMany({ where: { OR: orConds }, include: { fromCity: true, toCity: true } });
  for (const [a, b] of pairs) {
    const A = byName.get(a), B = byName.get(b);
    if (!A || !B || routes.some((x) => x.from_city_id === A.id && x.to_city_id === B.id)) continue;
    const km = estDistanceKm([A.lat, A.lng], [B.lat, B.lng]);
    const created = await prisma.route.create({
      data: { from_city_id: A.id, to_city_id: B.id, distance_km: km, base_fare: fareFor("NON_AC_SEATER", km) },
      include: { fromCity: true, toCity: true },
    }).catch(() => null);
    if (created) routes.push(created);
  }

  // Query 2: har route ka cheapest upcoming fare — ek hi grouped query me
  const mins = await prisma.trip.groupBy({
    by: ["route_id"],
    where: { route_id: { in: routes.map((x) => x.id) }, departure_time: { gt: new Date() } },
    _min: { fare: true },
  });
  const minFare = new Map(mins.map((m) => [m.route_id, m._min.fare]));

  const out = [];
  for (const [a, b] of pairs) {
    const r = routes.find((x) => x.fromCity.name === a && x.toCity.name === b);
    if (!r) continue;
    out.push({
      from: { id: r.fromCity.id, name: a },
      to: { id: r.toCity.id, name: b },
      distanceKm: r.distance_km,
      fromFare: minFare.get(r.id) ?? fareFor("NON_AC_SEATER", r.distance_km),
    });
  }
  const payload = { popular: out };
  setPopularCache(payload);
  res.json(payload);
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
  const depMs = new Date(t.departure_time).getTime();
  const addMin = (m) => new Date(depMs + m * 60000).toISOString();

  // 1) Admin-defined stations (with exact times) take priority
  let stops = null;
  if (t.route.stops_json) {
    try {
      const custom = JSON.parse(t.route.stops_json);
      if (Array.isArray(custom) && custom.length) {
        stops = [{ seq: 0, name: A.name, kind: "BOARDING", km: 0, arr: null, dep: t.departure_time, haltMin: 0, meal: false }];
        custom.forEach((c, i) => {
          const haltMin = Math.max(0, Number(c.depOffset) - Number(c.arrOffset));
          stops.push({
            seq: i + 1, name: c.name, kind: "STOP",
            km: Math.max(1, Math.round(km * Math.min(0.95, Number(c.arrOffset) / totalMin))),
            arr: addMin(Number(c.arrOffset)), dep: addMin(Number(c.depOffset)),
            haltMin, meal: haltMin >= 10,
          });
        });
        stops.push({ seq: stops.length, name: B.name, kind: "DROP", km: Math.round(km), arr: t.arrival_time, dep: null, haltMin: 0, meal: false });
      }
    } catch { /* fall through to computed stops */ }
  }

  // 2) Otherwise compute from real Gujarat cities near the from→to line
  if (!stops) {
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

    stops = [{ seq: 0, name: A.name, kind: "BOARDING", km: 0, arr: null, dep: t.departure_time, haltMin: 0, meal: false }];
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
  }

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
