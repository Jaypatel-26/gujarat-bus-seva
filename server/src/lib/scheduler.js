// 🗓️ Rolling trip scheduler + route-fixed conductor assignment
//
// Niyam (Jay ka rule): har ROUTE ka conductor FIXED — aaj ho ya kal,
// usi route pe har din WAHI conductor chalayega. Kisi conductor ka din khali nahi hoga
// (196 routes / 80 conductors → har conductor ko kam se kam 2-3 fixed routes milte hain,
//  aur har route ke har din 3–5 trips bante hain).
//
// ensureUpcomingTrips(): agle N din har route ke trips pehle se ready rakhta hai —
// server boot pe + har kuch ghante refresh hota hai, isliye schedule "khatam" kabhi nahi hota.
import { prisma } from "../db.js";
import { fareFor, durationMinFor, atTime } from "./util.js";

const DAY = 86400000;
const localDay = (offset) => { const d = new Date(Date.now() + offset * DAY); d.setHours(0, 0, 0, 0); return d; };

// Seed jaisi hi departure-slot templates (route id se choose hoti hai — deterministic)
export const SLOT_POOLS = [
  [[5, 45], [9, 30], [13, 0], [17, 15], [22, 30]],
  [[6, 15], [10, 0], [14, 30], [18, 45], [23, 15]],
  [[7, 30], [11, 0], [15, 45], [19, 30], [23, 55]],
  [[8, 0], [12, 0], [16, 30], [20, 45], [21, 45]],
];

// Har route ka EK fixed conductor — route id se deterministic (har din same)
export const fixedDriverForRoute = (drivers, routeId) =>
  drivers.length ? drivers[routeId % drivers.length] : null;

// Ek route ke ek din ke saare trip-rows (pure function — seed aur runtime dono use karte hain)
export function buildRouteDayTrips(route, day, dateOffset, buses, drivers, now = new Date()) {
  const rows = [];
  const pool = SLOT_POOLS[route.id % SLOT_POOLS.length];
  const nTrips = 3 + (route.id + dateOffset + 6) % 3; // 3–5 departures per day
  const driver = fixedDriverForRoute(drivers, route.id);
  for (let i = 0; i < nTrips; i++) {
    const [h, m] = pool[i];
    const bus = buses[(route.id + i * 3) % buses.length];
    const dep = atTime(day, h, m);
    const dur = durationMinFor(bus.type, route.distance_km);
    const status = dateOffset < 0 || (dateOffset === 0 && dep < new Date(now.getTime() - 60 * 60000)) ? "COMPLETED" : "SCHEDULED";
    rows.push({
      route_id: route.id, bus_id: bus.id,
      driver_id: driver ? driver.id : null,
      departure_time: dep, arrival_time: new Date(dep.getTime() + dur * 60000),
      date: day, status, fare: fareFor(bus.type, route.distance_km),
    });
  }
  return rows;
}

async function chunkedCreateMany(model, data, size = 200) {
  for (let i = 0; i < data.length; i += size) {
    await model.createMany({ data: data.slice(i, i + size) });
  }
}

// Agle `days` din (aaj se) har route ke trips ensure karo — sirf wahi route/date jahan koi trip nahi hai.
// Admin ke manually banaye/edge trips ko haath nahi lagata (covered routes skip).
export async function ensureUpcomingTrips(days = 10) {
  const [routes, buses, drivers] = await Promise.all([
    prisma.route.findMany({ orderBy: { id: "asc" } }),
    prisma.bus.findMany({ orderBy: { id: "asc" } }),
    prisma.user.findMany({ where: { role: "DRIVER" }, select: { id: true }, orderBy: { id: "asc" } }),
  ]);
  if (!routes.length || !buses.length || !drivers.length) return { created: 0 };

  const now = new Date();
  let created = 0;
  for (let off = 0; off < days; off++) {
    const day = localDay(off);
    const covered = await prisma.trip.groupBy({ by: ["route_id"], where: { date: day }, _count: { _all: true } });
    const coveredSet = new Set(covered.map((c) => c.route_id));
    const rows = [];
    for (const route of routes) {
      if (coveredSet.has(route.id)) continue; // is din is route ke trips pehle se hain
      rows.push(...buildRouteDayTrips(route, day, off, buses, drivers, now));
    }
    if (rows.length) {
      await chunkedCreateMany(prisma.trip, rows);
      created += rows.length;
    }
  }
  if (created) console.log(`🗓️  Rolling scheduler: ${created} naye trips schedule kiye (aaj → +${days - 1} din, route-fixed conductors ke saath)`);
  return { created };
}

// Ek-baari safai: jin routes ke aane wale trips MIXED conductors (ya bina conductor) ke hain,
// unhe unka FIXED conductor de do. Jo route pehle se ek-hi conductor pe hai (admin ne set kiya)
// use haath nahi lagate.
export async function fixMixedAssignments() {
  const drivers = await prisma.user.findMany({ where: { role: "DRIVER" }, select: { id: true }, orderBy: { id: "asc" } });
  if (!drivers.length) return { fixed: 0 };
  const today = localDay(0);
  const grouped = await prisma.trip.groupBy({ by: ["route_id", "driver_id"], where: { date: { gte: today } }, _count: { _all: true } });
  const buckets = new Map(); // route_id -> Set("d<id>" | "none")
  for (const g of grouped) {
    if (!buckets.has(g.route_id)) buckets.set(g.route_id, new Set());
    buckets.get(g.route_id).add(g.driver_id == null ? "none" : `d${g.driver_id}`);
  }
  let fixed = 0;
  for (const [routeId, set] of buckets) {
    if (set.size > 1 || set.has("none")) {
      const drv = fixedDriverForRoute(drivers, routeId);
      await prisma.trip.updateMany({ where: { route_id: routeId, date: { gte: today } }, data: { driver_id: drv.id } });
      fixed++;
    }
  }
  if (fixed) console.log(`🧭 ${fixed} routes ke conductor FIXED kar diye — ab har din WAHI conductor usi route pe chalega`);
  return { fixed };
}
