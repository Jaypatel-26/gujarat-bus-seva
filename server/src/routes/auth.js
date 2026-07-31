import { Router } from "express";
import { prisma } from "../db.js";
import { wrap, badRequest, signToken, hashPassword, verifyPassword } from "../lib/util.js";

const r = Router();

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  mobile: u.mobile,
  email: u.email,
  conductor_id: u.conductor_id,
  role: u.role,
});

// Conductor IDs look like GJ015500 (GJ + digits)
const isConductorId = (s) => /^gj\s?\d{3,}$/i.test(s.trim());

// POST /api/auth/login { identifier (mobile / email / conductor ID), password }
r.post("/login", wrap(async (req, res) => {
  const identifier = String(req.body.identifier || "").trim();
  const password = String(req.body.password || "");
  if (!identifier || !password) return badRequest(res, "Enter your mobile/email/conductor ID and password");

  let user = null;
  if (identifier.includes("@")) {
    user = await prisma.user.findFirst({ where: { email: identifier.toLowerCase() } });
  } else if (isConductorId(identifier)) {
    const cid = identifier.replace(/\s/g, "").toUpperCase();
    user = await prisma.user.findFirst({ where: { conductor_id: cid } });
  } else {
    const mobile = identifier.replace(/\D/g, "").slice(-10);
    user = await prisma.user.findUnique({ where: { mobile } });
  }
  if (!user || !verifyPassword(password, user.password_hash)) {
    return badRequest(res, "Incorrect ID or password — please try again");
  }
  res.json({ token: signToken(user), user: publicUser(user) });
}));

// POST /api/auth/signup { name, mobile, email, password }  — sab fields compulsory
r.post("/signup", wrap(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const mobile = String(req.body.mobile || "").replace(/\D/g, "").slice(-10);
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!name) return badRequest(res, "Please enter your name");
  if (!/^[6-9]\d{9}$/.test(mobile)) return badRequest(res, "Enter a valid 10-digit Indian mobile number");
  if (!/^\S+@\S+\.\S+$/.test(email)) return badRequest(res, "Enter a valid email address");
  if (password.length < 6) return badRequest(res, "Password must be at least 6 characters");

  if (await prisma.user.findUnique({ where: { mobile } })) {
    return badRequest(res, "This mobile number is already registered — please login");
  }
  if (await prisma.user.findFirst({ where: { email } })) {
    return badRequest(res, "This email is already registered — please login");
  }
  const user = await prisma.user.create({
    data: { name, mobile, email, password_hash: hashPassword(password), role: "PASSENGER" },
  });
  res.json({ token: signToken(user), user: publicUser(user) });
}));

export default r;
