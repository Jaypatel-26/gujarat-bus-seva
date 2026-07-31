import { Router } from "express";
import { prisma } from "../db.js";
import { wrap, badRequest, genOtp, signToken, OTP_TTL_MS, hashPassword, verifyPassword } from "../lib/util.js";

const r = Router();
const otpStore = new Map(); // mobile -> { otp, expiresAt }

// Sends the OTP by SMS using Twilio REST API (no SDK needed).
// Returns true only if the SMS was accepted by Twilio.
async function sendSmsOtp(mobile, otp) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return false;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: `+91${mobile}`,
        From: from,
        Body: `Gujarat Bus Seva: aapka OTP hai ${otp}. Ye 10 minute tak valid hai. Kisi ko share na karein.`,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("[sms] Twilio error:", res.status, txt.slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[sms] send failed:", e.message);
    return false;
  }
}

const publicUser = (u) => ({ id: u.id, name: u.name, mobile: u.mobile, email: u.email, role: u.role });

// POST /api/auth/login { identifier (mobile or email), password }
r.post("/login", wrap(async (req, res) => {
  const identifier = String(req.body.identifier || "").trim();
  const password = String(req.body.password || "");
  if (!identifier || !password) return badRequest(res, "Enter your mobile/email and password");

  let user = null;
  if (identifier.includes("@")) {
    user = await prisma.user.findFirst({ where: { email: identifier.toLowerCase() } });
  } else {
    const mobile = identifier.replace(/\D/g, "").slice(-10);
    user = await prisma.user.findUnique({ where: { mobile } });
  }
  if (!user || !verifyPassword(password, user.password_hash)) {
    return badRequest(res, "Incorrect mobile/email or password");
  }
  res.json({ token: signToken(user), user: publicUser(user) });
}));

// POST /api/auth/signup { name, mobile, email?, password }
r.post("/signup", wrap(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const mobile = String(req.body.mobile || "").replace(/\D/g, "").slice(-10);
  const email = String(req.body.email || "").trim().toLowerCase() || null;
  const password = String(req.body.password || "");
  if (!name) return badRequest(res, "Please enter your name");
  if (!/^[6-9]\d{9}$/.test(mobile)) return badRequest(res, "Enter a valid 10-digit Indian mobile number");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return badRequest(res, "Enter a valid email address");
  if (password.length < 6) return badRequest(res, "Password must be at least 6 characters");

  if (await prisma.user.findUnique({ where: { mobile } })) {
    return badRequest(res, "This mobile number is already registered — please login");
  }
  if (email && (await prisma.user.findFirst({ where: { email } }))) {
    return badRequest(res, "This email is already registered — please login");
  }
  const user = await prisma.user.create({
    data: { name, mobile, email, password_hash: hashPassword(password), role: "PASSENGER" },
  });
  res.json({ token: signToken(user), user: publicUser(user) });
}));

// POST /api/auth/otp/request { mobile }
r.post("/otp/request", wrap(async (req, res) => {
  const mobile = String(req.body.mobile || "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(mobile)) return badRequest(res, "Enter a valid 10-digit Indian mobile number");
  const otp = genOtp();
  otpStore.set(mobile, { otp, expiresAt: Date.now() + OTP_TTL_MS });
  // Real SMS via Twilio when creds exist; otherwise echo devOtp so demo login still works.
  const existing = await prisma.user.findUnique({ where: { mobile } });
  const smsSent = await sendSmsOtp(mobile, otp);
  res.json({
    ok: true,
    isNewUser: !existing,
    smsSent,
    devOtp: smsSent ? undefined : otp,
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
