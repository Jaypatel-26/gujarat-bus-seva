import { Router } from "express";
import { prisma } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { wrap, notFound, badRequest } from "../lib/util.js";
import { streamManifestPdf } from "../lib/ticket.js";

const r = Router();
r.use(authRequired("DRIVER", "ADMIN"));

async function ownTrip(req, res) {
  const trip = await prisma.trip.findUnique({
    where: { id: Number(req.params.id) },
    include: { route: { include: { fromCity: true, toCity: true } }, bus: true },
  });
  if (!trip) { notFound(res, "Trip not found"); return null; }
  if (req.user.role === "DRIVER" && trip.driver_id !== req.user.id) {
    res.status(403).json({ error: "Ye trip kisi aur conductor ko assigned hai" });
    return null;
  }
  return trip;
}

// GET /api/driver/me — conductor profile + stats (admin ko overall stats milte hain)
r.get("/me", wrap(async (req, res) => {
  const driverScope = req.user.role === "DRIVER" ? { driver_id: req.user.id } : {};
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [me, todayTrips, live, completed, total, conductors] = await Promise.all([
    req.user.role === "DRIVER"
      ? prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true, mobile: true, conductor_id: true, created_at: true } })
      : Promise.resolve(null),
    prisma.trip.count({ where: { ...driverScope, date: today } }),
    prisma.trip.count({ where: { ...driverScope, status: "IN_PROGRESS" } }),
    prisma.trip.count({ where: { ...driverScope, status: "COMPLETED" } }),
    prisma.trip.count({ where: driverScope }),
    prisma.user.count({ where: { role: "DRIVER" } }),
  ]);
  res.json({ conductor: me, stats: { todayTrips, live, completed, total, conductors } });
}));

// GET /api/driver/today — assigned trips for today + any already live
r.get("/today", wrap(async (req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const driverWhere = req.user.role === "DRIVER" ? { driver_id: req.user.id } : {};
  const trips = await prisma.trip.findMany({
    where: { ...driverWhere, OR: [{ date: today }, { status: "IN_PROGRESS" }] },
    include: {
      route: { include: { fromCity: true, toCity: true } },
      bus: true,
      _count: { select: { bookings: true } },
    },
    orderBy: { departure_time: "asc" },
  });
  res.json({ trips });
}));

// GET /api/driver/:id/manifest — passenger boarding list (check-in status ke saath)
r.get("/:id/manifest", wrap(async (req, res) => {
  const trip = await ownTrip(req, res);
  if (!trip) return;
  const bookings = await prisma.booking.findMany({
    where: { trip_id: trip.id, status: "CONFIRMED" },
    include: {
      passengers: true,
      seats: { include: { seat: true } },
      user: { select: { name: true, mobile: true } },
    },
  });
  const rows = [];
  let boarded = 0;
  for (const b of bookings) {
    const seatById = new Map(b.seats.map((s) => [s.seat_id, s.seat.seat_number]));
    const checked = !!b.checked_in_at;
    if (checked) boarded += b.passengers.length;
    for (const p of b.passengers) {
      rows.push({ seat: seatById.get(p.seat_id) || "-", name: p.name, age: p.age, gender: p.gender, pnr: b.pnr, contact: b.user.mobile, checked });
    }
  }
  rows.sort((a, b2) => String(a.seat).localeCompare(String(b2.seat), "en", { numeric: true }));
  res.json({ manifest: rows, total: rows.length, boarded });
}));

// GET /api/driver/:id/manifest.pdf — passenger list PDF download (browser ?token= se bhi)
r.get("/:id/manifest.pdf", wrap(async (req, res) => {
  const trip = await ownTrip(req, res);
  if (!trip) return;
  const conductor = await prisma.user.findUnique({ where: { id: trip.driver_id || -1 }, select: { name: true, conductor_id: true } }).catch(() => null);
  const bookings = await prisma.booking.findMany({
    where: { trip_id: trip.id, status: "CONFIRMED" },
    include: { passengers: true, seats: { include: { seat: true } }, user: { select: { name: true, mobile: true } } },
  });
  const rows = [];
  for (const b of bookings) {
    const seatById = new Map(b.seats.map((s) => [s.seat_id, s.seat.seat_number]));
    for (const p of b.passengers) {
      rows.push({ seat: seatById.get(p.seat_id) || "-", name: p.name, age: p.age, gender: p.gender, pnr: b.pnr, contact: b.user.mobile, checked: !!b.checked_in_at });
    }
  }
  rows.sort((a, b2) => String(a.seat).localeCompare(String(b2.seat), "en", { numeric: true }));
  streamManifestPdf({ trip, conductor, rows, res });
}));

// Ticket ka text (QR content ya seedha PNR) se PNR nikaalo
function extractPnr(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    const o = JSON.parse(text);
    if (o && o.pnr) return String(o.pnr).toUpperCase();
  } catch { /* not JSON — plain text */ }
  const m = text.toUpperCase().match(/GBS-?[A-Z0-9]{4,}/);
  return m ? (m[0].startsWith("GBS-") ? m[0] : `GBS-${m[0].slice(3)}`) : text.toUpperCase();
}

// POST /api/driver/:id/scan — e-ticket scan karke passenger ko onboard mark karo
r.post("/:id/scan", wrap(async (req, res) => {
  const trip = await ownTrip(req, res);
  if (!trip) return;
  const pnr = extractPnr(req.body.code);
  if (!pnr) return badRequest(res, "Ticket ka PNR nahi mila — dobara scan karo");

  const b = await prisma.booking.findUnique({
    where: { pnr },
    include: { passengers: true, seats: { include: { seat: true } }, trip: { include: { route: { include: { fromCity: true, toCity: true } } } } },
  });
  if (!b) return notFound(res, `PNR ${pnr} ki koi booking nahi mili`);
  if (b.trip_id !== trip.id) {
    return res.status(403).json({ error: `Ye ticket is trip ki nahi hai! Ye ${b.trip.route.fromCity.name} → ${b.trip.route.toCity.name} (${new Date(b.trip.date).toLocaleDateString("en-IN")}) ticket hai.` });
  }
  if (b.status === "PENDING") return badRequest(res, "Is ticket ka payment pending hai — confirm ticket nahi hai");
  if (b.status === "CANCELLED") return badRequest(res, "Ye ticket cancel ho chuki hai");

  const seats = b.seats.map((s) => s.seat.seat_number).sort((a, z) => String(a).localeCompare(String(z), "en", { numeric: true }));
  const names = b.passengers.map((p) => p.name);
  if (b.checked_in_at) {
    return res.json({ ok: true, already: true, pnr, seats, names, msg: `${pnr} pehle hi scan ho chuka hai ✅` });
  }
  await prisma.booking.update({ where: { pnr }, data: { checked_in_at: new Date() } });
  res.json({ ok: true, already: false, pnr, seats, names, msg: `${names.join(", ")} onboard ✅ — seat ${seats.join(", ")}` });
}));

// POST /api/driver/:id/scan/undo — galti se scan ho gaya to wapas hatao
r.post("/:id/scan/undo", wrap(async (req, res) => {
  const trip = await ownTrip(req, res);
  if (!trip) return;
  const pnr = extractPnr(req.body.code);
  if (!pnr) return badRequest(res, "PNR nahi mila");
  const b = await prisma.booking.findUnique({ where: { pnr } });
  if (!b || b.trip_id !== trip.id) return notFound(res, "Is trip pe ye booking nahi mili");
  await prisma.booking.update({ where: { pnr }, data: { checked_in_at: null } });
  res.json({ ok: true, msg: `${pnr} ka check-in hata diya` });
}));

// POST /api/driver/:id/start — mark trip in progress
r.post("/:id/start", wrap(async (req, res) => {
  const trip = await ownTrip(req, res);
  if (!trip) return;
  if (trip.status === "COMPLETED") return badRequest(res, "Trip already completed");
  if (trip.status !== "IN_PROGRESS") {
    await prisma.trip.update({ where: { id: trip.id }, data: { status: "IN_PROGRESS" } });
  }
  res.json({ ok: true, status: "IN_PROGRESS" });
}));

// POST /api/driver/:id/complete
r.post("/:id/complete", wrap(async (req, res) => {
  const trip = await ownTrip(req, res);
  if (!trip) return;
  await prisma.trip.update({ where: { id: trip.id }, data: { status: "COMPLETED" } });
  res.json({ ok: true, status: "COMPLETED" });
}));

export default r;
