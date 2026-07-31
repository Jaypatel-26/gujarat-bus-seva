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
const isEmail = (s) => /^\S+@\S+\.\S+$/.test(s);

// POST /api/auth/login — role-wise:
//   PASSENGER: { role:"PASSENGER", mobile, email, password } — sab compulsory
//   DRIVER:    { role:"DRIVER", conductorId, password }
//   ADMIN:     { role:"ADMIN", email, password }
r.post("/login", wrap(async (req, res) => {
  const role = String(req.body.role || "PASSENGER").toUpperCase();
  const password = String(req.body.password || "");
  if (!password) return badRequest(res, "Password daalna zaroori hai");

  let user = null;
  if (role === "PASSENGER") {
    const mobile = String(req.body.mobile || "").replace(/\D/g, "").slice(-10);
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!/^[6-9]\d{9}$/.test(mobile)) return badRequest(res, "Valid 10-digit mobile number daalo");
    if (!isEmail(email)) return badRequest(res, "Valid email daalo");
    user = await prisma.user.findUnique({ where: { mobile } });
    if (!user || (user.email || "").toLowerCase() !== email) {
      return badRequest(res, "Mobile number aur email ka joda match nahi hua — registration wali details daalo");
    }
    if (user.role !== "PASSENGER") return badRequest(res, "Ye account passenger ka nahi hai — sahi role choose karo");
  } else if (role === "ADMIN") {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!isEmail(email)) return badRequest(res, "Admin email daalo");
    user = await prisma.user.findFirst({ where: { email, role: "ADMIN" } });
    if (!user) return badRequest(res, "Ye email kisi admin account ka nahi hai");
  } else if (role === "DRIVER") {
    const cid = String(req.body.conductorId || "").replace(/\s/g, "").toUpperCase();
    if (!/^GJ\d{3,}$/.test(cid)) return badRequest(res, "Conductor ID daalo (jaise GJ015500)");
    user = await prisma.user.findFirst({ where: { conductor_id: cid, role: "DRIVER" } });
    if (!user) return badRequest(res, "Ye Conductor ID registered nahi hai — admin se check karo");
  } else {
    return badRequest(res, "Invalid role");
  }

  if (!user || !verifyPassword(password, user.password_hash)) {
    return badRequest(res, "Galat password — dubara try karo");
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
