import { Router } from "express";
import { prisma, bustCityCache } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { wrap, badRequest, notFound, dayStart, atTime, estDistanceKm, fareFor, durationMinFor, seatLayoutFor, hashPassword } from "../lib/util.js";
import { BUS_TYPES } from "../data/cities.js";

const r = Router();
r.use(authRequired("ADMIN"));

const DAY = 86400000;

// Stops ko stops_json me convert karta hai. Do formats chalte hain:
//  a) { name, arr: "HH:MM", dep: "HH:MM" }   — depTime (HH:MM) ko base maan ke
//  b) { name, arrOffset: <min>, depOffset: <min> } — seedha departure ke baad ke minutes
function parseStops(stopRows, depTime) {
  const hhmm = /^\d{1,2}:\d{2}$/;
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  if (!Array.isArray(stopRows) || !stopRows.length) return { rows: [] };
  const depMin = hhmm.test(depTime) ? toMin(depTime) : null;
  const rows = [];
  for (const s of stopRows) {
    const name = String(s?.name || "").trim();
    if (!name) continue;
    let arrOff, depOff;
    if (s.arrOffset != null || s.depOffset != null) {
      arrOff = Number(s.arrOffset); depOff = Number(s.depOffset);
      if (!Number.isFinite(arrOff) || !Number.isFinite(depOff)) return { error: `Station ${name}: galat time` };
      if (arrOff <= 0) return { error: `${name} ka arrival bus chalne ke BAAD hona chahiye` };
      if (depOff < arrOff) return { error: `${name}: chalegi time aayegi se pehle nahi ho sakta` };
    } else {
      if (depMin == null) return { error: "Stations dene ke liye 'Bus kab chalegi' time zaroori hai" };
      const arr = String(s.arr || ""), dep = String(s.dep || "");
      if (!hhmm.test(arr) || !hhmm.test(dep)) return { error: `Station ${name}: sahi time daalo (HH:MM)` };
      if (toMin(arr) <= depMin) return { error: `${name} ka arrival "bus chalegi" time ke BAAD hona chahiye` };
      if (toMin(dep) < toMin(arr)) return { error: `${name}: chalegi time aayegi se pehle nahi ho sakta` };
      arrOff = toMin(arr) - depMin; depOff = toMin(dep) - depMin;
    }
    rows.push({ name, arrOffset: Math.round(arrOff), depOffset: Math.round(depOff) });
  }
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].arrOffset < rows[i - 1].depOffset) return { error: "Stations ka time order galat hai — aage ke station ka time peeche wale se zyada hona chahiye" };
  }
  return { rows };
}

// ---------- Dashboard ----------
r.get("/stats", wrap(async (_req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const since = new Date(today.getTime() - 13 * DAY);
  const [bookingsToday, payments, usersCount, activeBuses, tripsToday, recent] = await Promise.all([
    prisma.booking.count({ where: { created_at: { gte: today }, status: { not: "CANCELLED" } } }),
    prisma.payment.findMany({ where: { status: "SUCCESS", created_at: { gte: since } }, select: { amount: true, created_at: true } }),
    prisma.user.count(),
    prisma.trip.count({ where: { status: "IN_PROGRESS" } }),
    prisma.trip.count({ where: { date: today } }),
    prisma.booking.findMany({
      include: { user: { select: { name: true, mobile: true } }, trip: { include: { route: { include: { fromCity: true, toCity: true } } } } },
      orderBy: { created_at: "desc" }, take: 6,
    }),
  ]);

  const seriesMap = new Map();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today.getTime() - i * DAY).toISOString().slice(0, 10);
    seriesMap.set(d, { day: d.slice(5).split("-").reverse().join("/"), revenue: 0 });
  }
  let revenueToday = 0;
  for (const p of payments) {
    const key = p.created_at.toISOString().slice(0, 10);
    const short = key.slice(5).split("-").reverse().join("/");
    if (seriesMap.has(key)) seriesMap.get(key).revenue += p.amount;
    if (p.created_at >= today) revenueToday += p.amount;
  }
  const revenueSeries = [...seriesMap.values()].reverse();

  // top routes by bookings (last 500 bookings sample)
  const sample = await prisma.booking.findMany({
    where: { status: "CONFIRMED" },
    include: { trip: { include: { route: { include: { fromCity: true, toCity: true } } } } },
    orderBy: { created_at: "desc" }, take: 500,
  });
  const routeCount = new Map();
  for (const b of sample) {
    const label = `${b.trip.route.fromCity.name} → ${b.trip.route.toCity.name}`;
    routeCount.set(label, (routeCount.get(label) || 0) + 1);
  }
  const topRoutes = [...routeCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([label, count]) => ({ label, count }));

  res.json({
    bookingsToday, revenueToday, usersCount, activeBuses, tripsToday,
    revenueSeries, topRoutes,
    recentBookings: recent.map((b) => ({
      pnr: b.pnr, status: b.status, total: b.total_fare,
      user: b.user?.name || "—",
      route: `${b.trip.route.fromCity.name} → ${b.trip.route.toCity.name}`,
      date: b.trip.date, createdAt: b.created_at,
    })),
  });
}));

// ---------- Bookings & reports ----------
async function bookingsQuery(req) {
  const { status, q } = req.query;
  const where = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { pnr: { contains: q } },
      { user: { name: { contains: q } } },
      { user: { mobile: { contains: q } } },
    ];
  }
  return prisma.booking.findMany({
    where,
    include: {
      user: { select: { name: true, mobile: true } },
      trip: { include: { route: { include: { fromCity: true, toCity: true } }, bus: true } },
      seats: { include: { seat: true } },
      payment: true,
    },
    orderBy: { created_at: "desc" },
    take: 200,
  });
}

r.get("/bookings", wrap(async (req, res) => {
  const rows = await bookingsQuery(req);
  res.json({
    bookings: rows.map((b) => ({
      pnr: b.pnr, status: b.status, total: b.total_fare, bookedAt: b.created_at,
      user: b.user?.name || "—", mobile: b.user?.mobile || "",
      route: `${b.trip.route.fromCity.name} → ${b.trip.route.toCity.name}`,
      date: b.trip.date, bus: b.trip.bus.bus_number,
      seats: b.seats.map((s) => s.seat.seat_number).join(", "),
      payment: b.payment ? { method: b.payment.method, status: b.payment.status } : null,
    })),
  });
}));

r.get("/bookings.csv", wrap(async (req, res) => {
  const rows = await bookingsQuery(req);
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [["PNR", "Passenger", "Mobile", "Route", "Journey Date", "Bus", "Seats", "Fare", "Status", "Payment", "Booked At"].join(",")];
  for (const b of rows) {
    lines.push([
      b.pnr, esc(b.user?.name), b.user?.mobile,
      esc(`${b.trip.route.fromCity.name} -> ${b.trip.route.toCity.name}`),
      b.trip.date.toISOString().slice(0, 10), b.trip.bus.bus_number,
      esc(b.seats.map((s) => s.seat.seat_number).join(" ")),
      b.total_fare, b.status, b.payment?.status || "", b.created_at.toISOString(),
    ].join(","));
  }
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=bookings.csv");
  res.send(lines.join("\n"));
}));

// ---------- Routes CRUD ----------
r.get("/routes", wrap(async (_req, res) => {
  const routes = await prisma.route.findMany({
    include: { fromCity: true, toCity: true, _count: { select: { trips: true } } },
    orderBy: { id: "asc" },
  });
  res.json({ routes });
}));

r.post("/routes", wrap(async (req, res) => {
  const fromId = Number(req.body.from_city_id), toId = Number(req.body.to_city_id);
  if (!fromId || !toId || fromId === toId) return badRequest(res, "Pick two different cities");
  const [a, b] = await Promise.all([prisma.city.findUnique({ where: { id: fromId } }), prisma.city.findUnique({ where: { id: toId } })]);
  if (!a || !b) return badRequest(res, "Unknown city");

  const km = Number(req.body.distance_km) || estDistanceKm([a.lat, a.lng], [b.lat, b.lng]);
  const customFare = Number(req.body.base_fare) || 0;
  const baseFare = customFare || fareFor("NON_AC_SEATER", km);

  // Optional trip timing (HH:MM) + admin-defined stations with arrival/departure times
  const hhmm = /^\d{1,2}:\d{2}$/;
  const depTime = String(req.body.dep_time || "").trim();
  const arrTime = String(req.body.arr_time || "").trim();
  let stops_json = null;

  if (Array.isArray(req.body.stops) && req.body.stops.length) {
    const parsed = parseStops(req.body.stops, depTime);
    if (parsed.error) return badRequest(res, parsed.error);
    if (parsed.rows.length) stops_json = JSON.stringify(parsed.rows);
  }

  const route = await prisma.route.create({
    data: { from_city_id: fromId, to_city_id: toId, distance_km: km, base_fare: baseFare, stops_json },
    include: { fromCity: true, toCity: true },
  }).catch(() => null);
  if (!route) return res.status(409).json({ error: "Route already exists" });

  // If departure time given, auto-schedule trips for the next 4 days
  let tripsCreated = 0;
  if (hhmm.test(depTime)) {
    const buses = await prisma.bus.findMany({ take: 8 });
    const drivers = await prisma.user.findMany({ where: { role: "DRIVER" }, take: 4 });
    if (buses.length && drivers.length) {
      const [H, M] = depTime.split(":").map(Number);
      for (let d = 1; d <= 4; d++) {
        const day = new Date(); day.setDate(day.getDate() + d); day.setHours(0, 0, 0, 0);
        const dep = new Date(day); dep.setHours(H, M, 0, 0);
        const bus = buses[d % buses.length];
        let arr;
        if (hhmm.test(arrTime)) {
          const [ah, am] = arrTime.split(":").map(Number);
          arr = new Date(day); arr.setHours(ah, am, 0, 0);
          if (arr <= dep) arr = new Date(arr.getTime() + 86400000); // overnight arrival
        } else {
          arr = new Date(dep.getTime() + durationMinFor(bus.type, km) * 60000);
        }
        await prisma.trip.create({
          data: {
            route_id: route.id, bus_id: bus.id,
            driver_id: drivers[d % drivers.length].id,
            departure_time: dep, arrival_time: arr,
            date: day, status: dep < new Date() ? "COMPLETED" : "SCHEDULED",
            fare: customFare || fareFor(bus.type, km),
          },
        });
        tripsCreated++;
      }
    }
  }

  res.json({ ok: true, route, tripsCreated });
}));

// GET /api/admin/routes/:id — route ki FULL details (stations + upcoming trips + stats)
r.get("/routes/:id", wrap(async (req, res) => {
  const route = await prisma.route.findUnique({
    where: { id: Number(req.params.id) },
    include: { fromCity: true, toCity: true },
  });
  if (!route) return notFound(res, "Route not found");
  const trips = await prisma.trip.findMany({
    where: { route_id: route.id, departure_time: { gte: new Date(Date.now() - 86400000) } },
    include: { bus: true, driver: { select: { name: true, conductor_id: true } }, _count: { select: { bookings: true } } },
    orderBy: [{ date: "asc" }, { departure_time: "asc" }],
    take: 40,
  });
  const stats = {
    totalTrips: await prisma.trip.count({ where: { route_id: route.id } }),
    totalBookings: await prisma.booking.count({ where: { status: "CONFIRMED", trip: { route_id: route.id } } }),
  };
  res.json({ route, trips, stats });
}));

// PUT /api/admin/routes/:id — sab kuch edit: cities, distance, fare, times, stations
r.put("/routes/:id", wrap(async (req, res) => {
  const id = Number(req.params.id);
  const route = await prisma.route.findUnique({ where: { id } });
  if (!route) return notFound(res, "Route not found");

  const hhmm = /^\d{1,2}:\d{2}$/;
  const depTime = String(req.body.dep_time || "").trim();
  const arrTime = String(req.body.arr_time || "").trim();

  const data = {};
  const fromId = Number(req.body.from_city_id) || route.from_city_id;
  const toId = Number(req.body.to_city_id) || route.to_city_id;
  if (fromId === toId) return badRequest(res, "From aur To same nahi ho sakte");
  data.from_city_id = fromId;
  data.to_city_id = toId;
  if (req.body.distance_km) data.distance_km = Number(req.body.distance_km);
  const fareChanged = req.body.base_fare && Number(req.body.base_fare) !== route.base_fare;
  if (req.body.base_fare) data.base_fare = Number(req.body.base_fare);

  // stations edit (empty array = clear back to auto). Offsets bhi chalte hain taaki
  // Route Studio se EK station edit karne pe baaki trips ka time na badle.
  if (Array.isArray(req.body.stops)) {
    if (!req.body.stops.filter((s) => s && s.name).length) {
      data.stops_json = null;
    } else {
      const parsed = parseStops(req.body.stops, depTime);
      if (parsed.error) return badRequest(res, parsed.error);
      data.stops_json = parsed.rows.length ? JSON.stringify(parsed.rows) : null;
    }
  }

  const updated = await prisma.route.update({ where: { id }, data, include: { fromCity: true, toCity: true } }).catch(() => null);
  if (!updated) return res.status(409).json({ error: "Ye from→to route pehle se exist karta hai" });

  // Future SCHEDULED trips pe naye time / fare apply karo
  let tripsUpdated = 0;
  if (hhmm.test(depTime) || fareChanged) {
    const future = await prisma.trip.findMany({
      where: { route_id: id, status: "SCHEDULED", departure_time: { gte: new Date() } },
      include: { bus: true },
    });
    for (const tr of future) {
      const upd = {};
      if (fareChanged) upd.fare = data.base_fare;
      if (hhmm.test(depTime)) {
        const [H, M] = depTime.split(":").map(Number);
        const dep = new Date(tr.date); dep.setHours(H, M, 0, 0);
        let arr;
        if (hhmm.test(arrTime)) {
          const [ah, am] = arrTime.split(":").map(Number);
          arr = new Date(tr.date); arr.setHours(ah, am, 0, 0);
          if (arr <= dep) arr = new Date(arr.getTime() + 86400000);
        } else {
          const dur = Math.max(30 * 60000, new Date(tr.arrival_time) - new Date(tr.departure_time));
          arr = new Date(dep.getTime() + dur);
        }
        upd.departure_time = dep;
        upd.arrival_time = arr;
      }
      await prisma.trip.update({ where: { id: tr.id }, data: upd });
      tripsUpdated++;
    }
  }

  res.json({ ok: true, route: updated, tripsUpdated });
}));

r.delete("/routes/:id", wrap(async (req, res) => {
  const count = await prisma.trip.count({ where: { route_id: Number(req.params.id) } });
  if (count) return res.status(409).json({ error: `Route has ${count} trips — delete those first` });
  await prisma.route.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
}));

// ---------- Buses / fleet ----------
r.get("/buses", wrap(async (_req, res) => {
  const buses = await prisma.bus.findMany({ include: { _count: { select: { trips: true, seats: true } } }, orderBy: { id: "asc" } });
  res.json({ buses, busTypes: BUS_TYPES });
}));

r.post("/buses", wrap(async (req, res) => {
  const { bus_number, operator_name, type } = req.body || {};
  const t = BUS_TYPES[type];
  if (!bus_number || !operator_name || !t) return badRequest(res, "bus_number, operator_name and a valid type are required");
  const bus = await prisma.bus.create({ data: { bus_number, operator_name, type, total_seats: t.seats } }).catch(() => null);
  if (!bus) return res.status(409).json({ error: "Bus number already exists" });
  await prisma.seat.createMany({ data: seatLayoutFor(type).map((s) => ({ ...s, bus_id: bus.id })) });
  res.json({ ok: true, bus });
}));

r.put("/buses/:id", wrap(async (req, res) => {
  const { bus_number, operator_name } = req.body || {};
  const bus = await prisma.bus.update({
    where: { id: Number(req.params.id) },
    data: { ...(bus_number ? { bus_number } : {}), ...(operator_name ? { operator_name } : {}) },
  });
  res.json({ ok: true, bus });
}));

r.delete("/buses/:id", wrap(async (req, res) => {
  const count = await prisma.trip.count({ where: { bus_id: Number(req.params.id) } });
  if (count) return res.status(409).json({ error: `Bus is assigned to ${count} trips` });
  await prisma.seat.deleteMany({ where: { bus_id: Number(req.params.id) } });
  await prisma.bus.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
}));

// ---------- Drivers ----------
r.get("/drivers", wrap(async (_req, res) => {
  const drivers = await prisma.user.findMany({
    where: { role: "DRIVER" },
    include: { _count: { select: { drivenTrips: true } } },
    orderBy: { id: "asc" },
  });
  res.json({ drivers: drivers.map((d) => ({ id: d.id, name: d.name, mobile: d.mobile, conductor_id: d.conductor_id, trips: d._count.drivenTrips })) });
}));

r.post("/drivers", wrap(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const mobile = String(req.body.mobile || "").replace(/\D/g, "").slice(-10);
  const conductorId = String(req.body.conductorId || "").trim().toUpperCase();
  const password = String(req.body.password || "");
  if (!name || !/^[6-9]\d{9}$/.test(mobile)) return badRequest(res, "Name and valid 10-digit mobile required");
  if (!/^GJ\d{4,}$/.test(conductorId)) return badRequest(res, "Conductor ID must look like GJ015503");
  if (password.length < 6) return badRequest(res, "Password must be at least 6 characters");
  if (await prisma.user.findFirst({ where: { conductor_id: conductorId } })) {
    return res.status(409).json({ error: "Ye Conductor ID pehle se registered hai" });
  }
  if (await prisma.user.findUnique({ where: { mobile } })) {
    return res.status(409).json({ error: "Mobile already registered" });
  }
  const driver = await prisma.user.create({
    data: { name, mobile, conductor_id: conductorId, role: "DRIVER", password_hash: hashPassword(password) },
  });
  res.json({ ok: true, driver: { id: driver.id, name: driver.name, mobile: driver.mobile, conductor_id: driver.conductor_id } });
}));

r.delete("/drivers/:id", wrap(async (req, res) => {
  await prisma.user.delete({ where: { id: Number(req.params.id) } }).catch(() => null);
  res.json({ ok: true });
}));

// ---------- Trips / schedule ----------
r.get("/trips", wrap(async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const trips = await prisma.trip.findMany({
    where: { date: dayStart(date) },
    include: {
      route: { include: { fromCity: true, toCity: true } },
      bus: true, driver: { select: { name: true } },
      _count: { select: { bookings: true } },
    },
    orderBy: { departure_time: "asc" },
    take: 200,
  });
  res.json({ trips });
}));

r.put("/trips/:id", wrap(async (req, res) => {
  const status = String(req.body.status || "").toUpperCase();
  if (!["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(status)) return badRequest(res, "Invalid status");
  const trip = await prisma.trip.update({ where: { id: Number(req.params.id) }, data: { status } });
  res.json({ ok: true, trip });
}));

r.post("/trips", wrap(async (req, res) => {
  const routeId = Number(req.body.route_id), busId = Number(req.body.bus_id);
  const date = req.body.date, time = String(req.body.time || "18:00");
  if (!routeId || !busId || !date) return badRequest(res, "route_id, bus_id and date required");
  const [route, bus] = await Promise.all([
    prisma.route.findUnique({ where: { id: routeId } }),
    prisma.bus.findUnique({ where: { id: busId } }),
  ]);
  if (!route || !bus) return badRequest(res, "Unknown route or bus");
  const [h, m] = time.split(":").map(Number);
  const dep = atTime(dayStart(date), h || 0, m || 0);
  const dur = durationMinFor(bus.type, route.distance_km);
  const trip = await prisma.trip.create({
    data: {
      route_id: routeId, bus_id: busId, departure_time: dep,
      arrival_time: new Date(dep.getTime() + dur * 60000),
      date: dayStart(date), fare: fareFor(bus.type, route.distance_km), status: "SCHEDULED",
    },
  });
  res.json({ ok: true, trip });
}));

// ---------- Live fleet ----------

export default r;
