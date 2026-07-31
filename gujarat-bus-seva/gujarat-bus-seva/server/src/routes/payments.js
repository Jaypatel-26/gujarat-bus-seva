import { Router } from "express";
import crypto from "node:crypto";
import { prisma } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { wrap, badRequest, notFound } from "../lib/util.js";

const r = Router();

// POST /api/payments/confirm { pnr, mock } OR { pnr, razorpay_order_id, razorpay_payment_id, razorpay_signature }
r.post("/confirm", authRequired(), wrap(async (req, res) => {
  const { pnr } = req.body || {};
  const booking = await prisma.booking.findUnique({
    where: { pnr },
    include: { payment: true },
  });
  if (!booking) return notFound(res, "Booking not found");
  if (booking.user_id !== req.user.id && req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "This booking belongs to another account" });
  }
  if (booking.status === "CANCELLED") return badRequest(res, "Booking was cancelled");
  if (!booking.payment) return badRequest(res, "No payment record for this booking");

  if (booking.status === "CONFIRMED") return res.json({ ok: true, pnr, already: true });

  if (booking.payment.method === "MOCK") {
    if (!req.body.mock) return badRequest(res, "Demo payment must be confirmed with { mock: true }");
    await prisma.payment.update({
      where: { id: booking.payment.id },
      data: { status: "SUCCESS", transaction_id: `pay_mock_${Date.now()}` },
    });
  } else {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (expected !== razorpay_signature || razorpay_order_id !== booking.payment.transaction_id) {
      await prisma.payment.update({ where: { id: booking.payment.id }, data: { status: "FAILED" } });
      return badRequest(res, "Payment verification failed. If money was debited it will be auto-refunded.");
    }
    await prisma.payment.update({
      where: { id: booking.payment.id },
      data: { status: "SUCCESS", transaction_id: razorpay_payment_id },
    });
  }

  await prisma.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED", qr_code: pnr } });
  res.json({ ok: true, pnr });
}));

export default r;
