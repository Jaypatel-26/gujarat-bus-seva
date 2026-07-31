import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { BUS_TYPES } from "../data/cities.js";

export const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-gujarat-bus-seva";
export const OTP_TTL_MS = 5 * 60 * 1000;
export const HOLD_TTL_MS = 15 * 60 * 1000; // seat hold time while payment pending

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: "30d" });
}

export function genOtp() {
  return String(crypto.randomInt(100000, 999999));
}

// Password hashing using Node's built-in scrypt (format: "salt:hash")
export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const calc = crypto.scryptSync(String(password), salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), calc);
}

export function genPnr() {
  return "GBS-" + crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
}

export function haversineKm([lat1, lng1], [lat2, lng2]) {
  const R = 6371, dLat = ((lat2 - lat1) * Math.PI) / 180, dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function estDistanceKm(a, b) {
  return Math.max(15, Math.round(haversineKm(a, b) * 1.28)); // straight-line × road factor
}

export function fareFor(type, km) {
  const t = BUS_TYPES[type] || BUS_TYPES.NON_AC_SEATER;
  return Math.max(69, Math.round((km * t.perKm) / 10) * 10);
}

export function durationMinFor(type, km) {
  const t = BUS_TYPES[type] || BUS_TYPES.NON_AC_SEATER;
  return Math.max(30, Math.round((km / t.avgKmh) * 60));
}

export const minsToText = (m) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}m`;

export function dayStart(dateStr) {
  // "YYYY-MM-DD" -> Date at local midnight
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d, 0, 0, 0, 0);
}

export function atTime(day, h, m = 0) {
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
}

export const badRequest = (res, msg) => res.status(400).json({ error: msg });
export const notFound = (res, msg = "Not found") => res.status(404).json({ error: msg });

// Seat layout generator: returns [{seat_number, seat_type, deck, row, col}]
export function seatLayoutFor(type) {
  const t = BUS_TYPES[type] || BUS_TYPES.NON_AC_SEATER;
  const seats = [];
  if (type === "AC_SLEEPER") {
    // 2+1 sleeper: 5 rows × 3 berths per deck → 30
    let n = 1;
    for (const deck of ["LOWER", "UPPER"]) {
      for (let r = 0; r < 5; r++) {
        for (const c of [0, 2, 3]) {
          seats.push({ seat_number: `${deck === "LOWER" ? "L" : "U"}${n++}`, seat_type: "BERTH", deck, row: r, col: c });
        }
      }
    }
  } else {
    // 2+2 seater: rows of 4 with an aisle between col 1 and 3
    const rows = Math.ceil(t.seats / 4);
    let n = 1;
    for (let r = 0; r < rows && n <= t.seats; r++) {
      for (const c of [0, 1, 3, 4]) {
        if (n > t.seats) break;
        seats.push({ seat_number: `S${n++}`, seat_type: "SEAT", deck: "LOWER", row: r, col: c });
      }
    }
  }
  return seats;
}
