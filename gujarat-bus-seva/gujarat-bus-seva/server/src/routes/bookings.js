import { Router } from "express";
import { prisma } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { wrap, badRequest, notFound, genPnr } from "../lib/util.js";
import { qrDataUrl, streamTicketPdf } from "../lib/ticket.js";
import { razorpayOrder } from "../lib/razorpay.js";
import { occupiedSeatMap } from "./trips.js";

const r = Router();
r.use(authRequired());

const fullBookingInclude = {
  trip: { include: { route: { include: { fromCity: true, toCity: true } }, bus: true } },
  passengers: true,
  seats: { include: { seat: true } },
  payment: true,
};

function withSeatNumbers(b) {
  const seatById = new Map(b.seats.map((s) => [s.seat_id, s.seat.seat_number]));
  return {
    ...b,
    seatNumbers: b.seats.map((s) => s.seat.seat_number),
    passengers: b.passengers.map((p) => ({ ...p, seat_number: seatById.get(p.seat_id) || null })),
  };
}

// POST /api/bookings — create booking (seats held for 15 min) + payment order
r.post("/", wrap(async (req, res) => {
  const { tripId, seatIds, passengers, contactEmail, contactMobile } = req.body || {};
  if (!tripId || !Array.isArray(seatIds) || !seatIds.length) return badRequest(res, "Select at least one seat");
  if (seatIds.length > 6) return badRequest(res, "Maximum 6 seats per booking");
  if (!Array.isArray(passengers) || passengers.length !== seatIds.length) {
    return badRequest(res, "Passenger details required for every seat");
  }
  for (const p of passengers) {
    if (!p.name || !p.age || !p.gender) return badRequest(res, "Each passenger needs name, age and gender");
    if (p.age < 1 || p.age > 100) return badRequest(res, "Enter a valid age");
  }

  const trip = await prisma.trip.findUnique({
    where: { id: Number(tripId) },
    include: { bus: true, route: { include: { fromCity: true, toCity: true } } },
  });
  if (!trip) return notFound(res, "Trip not found");
  if (trip.status !== "SCHEDULED") return badRequest(res, "This trip is not open for booking");
  if (trip.departure_time < new Date()) return badRequest(res, "This bus has already departed");

  const seats = await prisma.seat.findMany({ where: { id: { in: seatIds } } });
  if (seats.length !== seatIds.length || seats.some((s) => s.bus_id !== trip.bus_id)) {
    return badRequest(res, "Invalid seat selection");
  }
  const occ = await occupiedSeatMap([trip.id]);
  const taken = new Set(occ.get(trip.id) || []);
  if (seatIds.some((id) => taken.has(id))) {
    return res.status(409).json({ error: "Some seats were just booked by another passenger. Please pick different seats." });
  }

  const total = trip.fare * seatIds.length;
  const booking = await prisma.booking.create({
    data: {
      pnr: genPnr(),
      user_id: req.user.id,
      trip_id: trip.id,
      total_fare: total,
      status: "PENDING",
      contact_email: contactEmail || null,
      contact_mobile: contactMobile || null,
      seats: { create: seatIds.map((id) => ({ seat_id: id })) },
      passengers: { create: passengers.map((p) => ({ name: p.name.trim(), age: Number(p.age), gender: p.gender, seat_id: p.seatId })) },
    },
    include: fullBookingInclude,
  });

  const order = await razorpayOrder(booking);
  await prisma.payment.create({
    data: {
      booking_id: booking.id,
      amount: total,
      method: order.mock ? "MOCK" : "RAZORPAY",
      transaction_id: order.id,
    },
  });

  const b = withSeatNumbers(booking);
  res.json({
    booking: { id: b.id, pnr: b.pnr, totalFare: b.total_fare, status: b.status, seatNumbers: b.seatNumbers, trip: b.trip },
    order,
  });
}));

// GET /api/bookings/mine
r.get("/mine", wrap(async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { user_id: req.user.id },
    include: fullBookingInclude,
    orderBy: { created_at: "desc" },
    take: 60,
  });
  res.json({ bookings: bookings.map(withSeatNumbers) });
}));

// GET /api/bookings/:pnr — full booking + QR (owner or admin)
r.get("/:pnr", wrap(async (req, res) => {
  const b0 = await prisma.booking.findUnique({ where: { pnr: req.params.pnr }, include: fullBookingInclude });
  if (!b0) return notFound(res, "Booking not found");
  if (b0.user_id !== req.user.id && req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "This booking belongs to another account" });
  }
  const b = withSeatNumbers(b0);
  const qr = await qrDataUrl({
    pnr: b.pnr,
    route: `${b.trip.route.fromCity.name} → ${b.trip.route.toCity.name}`,
    date: new Date(b.trip.date).toISOString().slice(0, 10),
    seats: b.seatNumbers.join(","),
  });
  // Reuse the existing payment order if still pending (don't create duplicates)
  let order = null;
  if (b.status === "PENDING" && b.payment) {
    order = b.payment.method === "MOCK"
      ? { id: b.payment.transaction_id || `order_mock_${b.pnr}`, key: "mock", amount: Math.round(b.total_fare * 100), currency: "INR", mock: true }
      : { id: b.payment.transaction_id, key: process.env.RAZORPAY_KEY_ID, amount: Math.round(b.total_fare * 100), currency: "INR", mock: false };
  }
  res.json({ booking: b, qr, order });
}));

// POST /api/bookings/:pnr/cancel
r.post("/:pnr/cancel", wrap(async (req, res) => {
  const b = await prisma.booking.findUnique({ where: { pnr: req.params.pnr }, include: { payment: true, trip: true } });
  if (!b) return notFound(res, "Booking not found");
  if (b.user_id !== req.user.id && req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "This booking belongs to another account" });
  }
  if (b.status === "CANCELLED") return badRequest(res, "Booking is already cancelled");
  if (b.trip.departure_time < new Date() && req.user.role !== "ADMIN") {
    return badRequest(res, "This bus has already departed — cancellation window closed");
  }
  await prisma.booking.update({ where: { id: b.id }, data: { status: "CANCELLED" } });
  if (b.payment?.status === "SUCCESS") {
    await prisma.payment.update({ where: { id: b.payment.id }, data: { status: "REFUNDED" } });
  }
  res.json({ ok: true, refund: b.payment?.status === "SUCCESS" ? b.total_fare : 0 });
}));

// GET /api/bookings/:pnr/ticket.pdf
r.get("/:pnr/ticket.pdf", wrap(async (req, res) => {
  const b0 = await prisma.booking.findUnique({ where: { pnr: req.params.pnr }, include: fullBookingInclude });
  if (!b0) return notFound(res, "Booking not found");
  if (b0.user_id !== req.user.id && req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "This booking belongs to another account" });
  }
  if (b0.status !== "CONFIRMED") return badRequest(res, "Ticket is available after payment confirmation");
  await streamTicketPdf(withSeatNumbers(b0), res);
}));

export default r;
