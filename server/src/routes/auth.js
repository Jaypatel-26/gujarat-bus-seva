import { Router } from "express";
import { prisma } from "../db.js";
import { wrap, badRequest, genOtp, signToken, OTP_TTL_MS } from "../lib/util.js";

const r = Router();
const otpStore = new Map(); // mobile -> { otp, expiresAt }

// POST /api/auth/otp/request { mobile }
r.post("/otp/request", wrap(async (req, res) => {
  const mobile = String(req.body.mobile || "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(mobile)) return badRequest(res, "Enter a valid 10-digit Indian mobile number");
  const otp = genOtp();
  otpStore.set(mobile, { otp, expiresAt: Date.now() + OTP_TTL_MS });
  // NOTE: plug Twilio/Firebase here for real SMS. Until SMS creds exist, echo the OTP
  // back as devOtp (even in production) so demo login works on the live site.
  const smsConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  const existing = await prisma.user.findUnique({ where: { mobile } });
  res.json({
    ok: true,
    isNewUser: !existing,
    devOtp: smsConfigured ? undefined : otp,
  });
}));

// POST /api/auth/otp/verify { mobile, otp, name? }
r.post("/otp/verify", wrap(async (req, res) => {
  const mobile = String(req.body.mobile || "").replace(/\D/g, "").slice(-10);
  const rec = otpStore.get(mobile);
  if (!rec || rec.expiresAt < Date.now()) return badRequest(res, "OTP expired. Please request a new one.");
  if (String(req.body.otp) !== rec.otp) return badRequest(res, "Incorrect OTP");
  otpStore.delete(mobile);

  let user = await prisma.user.findUnique({ where: { mobile } });
  if (!user) {
    const name = String(req.body.name || "").trim();
    if (!name) return badRequest(res, "Please tell us your name to create your account");
    user = await prisma.user.create({ data: { mobile, name, role: "PASSENGER" } });
  }
  const token = signToken(user);
  res.json({ token, user: { id: user.id, name: user.name, mobile: user.mobile, role: user.role } });
}));

export default r;
