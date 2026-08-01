import { Router } from "express";
import { prisma } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { wrap, notFound, badRequest } from "../lib/util.js";

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

// GET /api/driver/:id/manifest — passenger boarding list
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
  for (const b of bookings) {
    const seatById = new Map(b.seats.map((s) => [s.seat_id, s.seat.seat_number]));
    for (const p of b.passengers) {
      rows.push({ seat: seatById.get(p.seat_id) || "-", name: p.name, age: p.age, gender: p.gender, pnr: b.pnr, contact: b.user.mobile });
    }
  }
  rows.sort((a, b2) => String(a.seat).localeCompare(String(b2.seat), "en", { numeric: true }));
  res.json({ manifest: rows, total: rows.length });
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
