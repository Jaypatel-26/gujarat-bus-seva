import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.js";
import cityRoutes from "./routes/cities.js";
import tripRoutes from "./routes/trips.js";
import bookingRoutes from "./routes/bookings.js";
import paymentRoutes from "./routes/payments.js";
import reviewRoutes from "./routes/reviews.js";
import adminRoutes from "./routes/admin.js";
import driverRoutes from "./routes/driver.js";
import { razorpayConfigured } from "./lib/razorpay.js";
import { ensureUpcomingTrips } from "./lib/scheduler.js";

const app = express();

// Render injects bare hosts (no scheme); normalize so CORS origin matching works
const toOrigin = (s) => (s && !/^https?:\/\//.test(s) ? `https://${s}` : s);
const allowed = (process.env.CLIENT_URL || "http://localhost:5173").split(",").map(toOrigin);
app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowed.includes(origin) || process.env.NODE_ENV !== "production"), credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "Gujarat Bus Seva API", time: new Date().toISOString() }));
app.get("/api/config", (_req, res) => res.json({
  appName: "Gujarat Bus Seva",
  razorpay: razorpayConfigured() ? { key: process.env.RAZORPAY_KEY_ID } : { key: "mock" },
  demoMode: !razorpayConfigured(),
}));

app.use("/api/auth", authRoutes);
app.use("/api/cities", cityRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/driver", driverRoutes);

app.use("/api", (_req, res) => res.status(404).json({ error: "API route not found" }));

// Central error handler — always JSON, never an abrupt HTML error page
app.use((err, _req, res, _next) => {
  console.error("💥", err.message);
  res.status(err.status || 500).json({ error: err.message || "Something went wrong. Please try again." });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`🚌 Gujarat Bus Seva API running on http://localhost:${PORT}`);
  // Rolling schedule: agle 10 din ke trips hamesha ready rakho (route-fixed conductors ke saath)
  // — boot pe ek baar, phir har 6 ghante (schedule kabhi "khatam" nahi hoga, console kabhi khali nahi dikhega)
  const runScheduler = () => ensureUpcomingTrips(10).catch((e) => console.error("scheduler:", e.message));
  setTimeout(runScheduler, 3000); // DB connect settle hone do
  setInterval(runScheduler, 6 * 3600 * 1000).unref();
});
