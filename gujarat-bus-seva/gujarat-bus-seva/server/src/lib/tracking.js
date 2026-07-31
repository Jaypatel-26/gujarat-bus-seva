// 🛰️ Live tracking engine.
// A real deployment receives GPS from the driver app (see /api/driver/location).
// For the MVP/demo, active trips are SIMULATED along the straight corridor
// between the two cities (with realistic wobble), so tracking works end-to-end.
import { prisma, getCities } from "../db.js";
import { haversineKm } from "./util.js";

const SIM_SPEED = Number(process.env.SIM_SPEED || 100); // 1 = realtime; 100 → a 5h trip crosses the map in ~3 min (demo)
const TICK_MS = 4000;

const sims = new Map(); // tripId -> sim state
let ioRef = null;

function lerp(a, b, t) { return a + (b - a) * t; }

// Pick cities that lie on the corridor between from & to (for "next stop" info)
async function corridorStops(fromCity, toCity) {
  const [A, B] = [[fromCity.lat, fromCity.lng], [toCity.lat, toCity.lng]];
  const distAB = haversineKm(A, B) || 1;
  const cities = await getCities();
  const stops = [];
  for (const c of cities) {
    if (c.id === fromCity.id || c.id === toCity.id) continue;
    const P = [c.lat, c.lng];
    // project P on AB (equirectangular approx)
    const t = ((P[0] - A[0]) * (B[0] - A[0]) + (P[1] - A[1]) * (B[1] - A[1])) /
      (distAB > 0 ? (Math.abs(B[0] - A[0]) ** 2 + Math.abs(B[1] - A[1]) ** 2) || 1 : 1);
    const clamped = Math.max(0, Math.min(1, t));
    const proj = [A[0] + (B[0] - A[0]) * clamped, A[1] + (B[1] - A[1]) * clamped];
    const perp = haversineKm(P, proj);
    if (perp < 12 && clamped > 0.04 && clamped < 0.96) stops.push({ t: clamped, name: c.name });
  }
  return stops.sort((a, b) => a.t - b.t);
}

export function isLive(tripId) { return sims.has(Number(tripId)); }

export async function startSimulation(trip) {
  const id = Number(trip.id);
  if (sims.has(id)) return sims.get(id);
  const fromCity = trip.route.fromCity, toCity = trip.route.toCity;
  const durationMin = Math.max(15, (new Date(trip.arrival_time) - new Date(trip.departure_time)) / 60000);
  const distanceKm = trip.route.distance_km;
  const sim = {
    tripId: id,
    A: [fromCity.lat, fromCity.lng],
    B: [toCity.lat, toCity.lng],
    fromName: fromCity.name,
    toName: toCity.name,
    // Pretend the bus is already 5%–45% into the journey (scaled by SIM_SPEED,
    // so it stays mid-route on the map instead of instantly arriving).
    startedAt: Date.now() - ((0.05 + Math.random() * 0.4) * durationMin * 60000) / SIM_SPEED,
    durationMin,
    distanceKm,
    stops: await corridorStops(fromCity, toCity),
    speed: 0,
  };
  sims.set(id, sim);
  await tickSim(sim); // emit immediately so maps have an initial position
  return sim;
}

export async function stopSimulation(tripId, status = "COMPLETED") {
  const id = Number(tripId);
  sims.delete(id);
  ioRef?.to(`trip:${id}`).emit("trip:ended", { tripId: id, status });
  broadcastFleet();
}

function positionOf(sim) {
  const virtualElapsedMin = ((Date.now() - sim.startedAt) / 60000) * SIM_SPEED;
  const progress = Math.min(1, Math.max(0.01, virtualElapsedMin / sim.durationMin));
  const wobble = Math.sin(progress * 40) * 0.004; // slight road-like curve
  const lat = lerp(sim.A[0], sim.B[0], progress) + wobble;
  const lng = lerp(sim.A[1], sim.B[1], progress) + wobble * 0.6;
  return { lat, lng, progress };
}

async function tickSim(sim) {
  const { lat, lng, progress } = positionOf(sim);
  sim.speed = Math.max(0, Math.min(92, 52 + 18 * Math.sin(progress * 25) + 6 * Math.sin(progress * 90)));
  const next = sim.stops.find((s) => s.t > progress + 0.01);
  const remainingMin = Math.max(0, (1 - progress) * sim.durationMin);
  const payload = {
    tripId: sim.tripId,
    lat: +lat.toFixed(5),
    lng: +lng.toFixed(5),
    speed: +sim.speed.toFixed(0),
    progress: +progress.toFixed(3),
    nextStop: next ? next.name : sim.toName,
    etaMinutes: Math.ceil(remainingMin),
    from: sim.fromName,
    to: sim.toName,
    updatedAt: new Date().toISOString(),
  };
  await prisma.liveLocation.upsert({
    where: { trip_id: sim.tripId },
    create: { trip_id: sim.tripId, latitude: payload.lat, longitude: payload.lng, speed: payload.speed, progress: payload.progress },
    update: { latitude: payload.lat, longitude: payload.lng, speed: payload.speed, progress: payload.progress },
  }).catch(() => {});
  ioRef?.to(`trip:${sim.tripId}`).emit("location", payload);
  return payload;
}

async function broadcastFleet() {
  if (!ioRef) return;
  const fleet = [];
  for (const sim of sims.values()) {
    const { lat, lng, progress } = positionOf(sim);
    fleet.push({ tripId: sim.tripId, lat: +lat.toFixed(5), lng: +lng.toFixed(5), progress: +progress.toFixed(3), from: sim.fromName, to: sim.toName });
  }
  ioRef.to("fleet").emit("fleet", fleet);
}

export async function initTracking(io) {
  ioRef = io;
  io.on("connection", (socket) => {
    socket.on("joinTrip", (tripId) => socket.join(`trip:${Number(tripId)}`));
    socket.on("leaveTrip", (tripId) => socket.leave(`trip:${Number(tripId)}`));
    socket.on("joinFleet", () => socket.join("fleet"));
  });

  // Resume simulations for trips already IN_PROGRESS (e.g. after server restart)
  const live = await prisma.trip.findMany({
    where: { status: "IN_PROGRESS" },
    include: { route: { include: { fromCity: true, toCity: true } } },
  }).catch(() => []);
  for (const t of live) startSimulation(t);

  setInterval(async () => {
    for (const sim of [...sims.values()]) {
      const p = await tickSim(sim);
      if (p.progress >= 1) {
        sims.delete(sim.tripId);
        await prisma.trip.update({ where: { id: sim.tripId }, data: { status: "COMPLETED" } }).catch(() => {});
        io.to(`trip:${sim.tripId}`).emit("trip:ended", { tripId: sim.tripId, status: "COMPLETED" });
      }
    }
    broadcastFleet();
  }, TICK_MS);

  console.log(`🛰️  Tracking engine ready (${live.length} live trip(s) resumed, sim speed ×${SIM_SPEED})`);
}
