// 🌱 Seed: 41 Gujarat cities, route network, fleet + seat layouts,
// trips for past 1 day → next 4 days, demo bookings, reviews, users.
// Safe to run multiple times — it skips when data already exists (use `--force` to reset).
import { PrismaClient } from "@prisma/client";
import {
  CITIES, CITY_COORDS, ROUTE_PAIRS, BUSES, BUS_TYPES, REVIEW_SNIPPETS,
} from "../src/data/cities.js";
import { seatLayoutFor, fareFor, durationMinFor, atTime, genPnr, hashPassword } from "../src/lib/util.js";

const prisma = new PrismaClient();
const DAY = 86400000;
const localDay = (offset) => { const d = new Date(Date.now() + offset * DAY); d.setHours(0, 0, 0, 0); return d; };
const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];

// Prisma/SQLite protects against too many bound variables — createMany in chunks
async function chunkedCreateMany(model, data, size = 100) {
  for (let i = 0; i < data.length; i += size) {
    await model.createMany({ data: data.slice(i, i + size) });
  }
}

const NAMES = ["Amit Patel", "Priya Shah", "Rahul Mehta", "Kinjal Desai", "Hardik Solanki",
  "Neha Trivedi", "Jayesh Raval", "Bhavna Joshi", "Kiran Chaudhary", "Mansi Bhatt",
  "Rakesh Prajapati", "Foram Vora", "Nilesh Gohil", "Payal Makwana", "Viral Parikh"];

/* 🚌 Conductor pool (80) — itne conductors ki har ek ko din ke sirf ~10 trips aayein.
   Pehle 3 demo wale hain (GJ015500-502 / conductor123), baaki GJ015503+ bhi same password. */
const CONDUCTOR_FIRST = ["Arjun", "Bhavesh", "Chirag", "Dhruv", "Farukh", "Gopal", "Harsh", "Imran", "Jignesh", "Ketan", "Laxman", "Milan"];
const CONDUCTOR_LAST = ["Ahir", "Chavda", "Desai", "Gamit", "Jadeja", "Katara", "Parmar", "Vaghela"];
const CONDUCTOR_POOL = (() => {
  const pool = [
    { name: "Mahesh Chauhan", mobile: "9000000002", conductorId: "GJ015500" },
    { name: "Baldev Rathod", mobile: "9000000003", conductorId: "GJ015501" },
    { name: "Suresh Damor", mobile: "9000000004", conductorId: "GJ015502" },
  ];
  let n = 0;
  outer: for (const f of CONDUCTOR_FIRST) {
    for (const l of CONDUCTOR_LAST) {
      const idx = 3 + n;
      if (idx >= 80) break outer;
      pool.push({ name: `${f} ${l}`, mobile: `9810${String(600000 + n).slice(-6)}`, conductorId: `GJ0155${String(idx).padStart(2, "0")}` });
      n++;
    }
  }
  return pool;
})();

// Pool ke conductors ensure karo (kabhi delete/wipe nahi karta)
async function ensureConductorPool() {
  const out = [];
  for (const c of CONDUCTOR_POOL) {
    let u = await prisma.user.findFirst({ where: { OR: [{ conductor_id: c.conductorId }, { mobile: c.mobile }] } });
    if (!u) {
      u = await prisma.user.create({
        data: { name: c.name, mobile: c.mobile, role: "DRIVER", conductor_id: c.conductorId, password_hash: hashPassword("conductor123"), password_plain: "conductor123" },
      });
    }
    out.push(u);
  }
  return out;
}

// Agar aaj ke trips kuch hi conductors pe dheel ho (max > 3× ideal) to aaj+bhavi trips ko pool me barabar baanto
async function rebalanceTrips(drivers) {
  const todayStart = localDay(0);
  const todayTrips = await prisma.trip.count({ where: { date: todayStart } });
  if (!todayTrips || !drivers.length) return;
  const ideal = Math.ceil(todayTrips / drivers.length);
  const per = await prisma.trip.groupBy({ by: ["driver_id"], where: { date: todayStart }, _count: { _all: true } });
  const maxLoad = per.reduce((m, p) => Math.max(m, p._count._all), 0);
  if (maxLoad <= ideal * 3) return; // pehle se balanced
  console.log(`🔁 Conductors badh gaye — ${todayTrips} trips ko ${drivers.length} conductors me baant rahe (~${ideal}/conductor/day)…`);
  // Per-DAY round-robin (ids route-wise blocks me hain — global modulo se din bhar me uneven padta hai)
  const N = drivers.length;
  const all = await prisma.trip.findMany({ where: { date: { gte: todayStart } }, select: { id: true, date: true }, orderBy: [{ date: "asc" }, { id: "asc" }] });
  const byDay = new Map();
  for (const t of all) {
    const key = t.date.toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(t.id);
  }
  let dayIdx = 0;
  for (const ids of byDay.values()) {
    for (let k = 0; k < N; k++) {
      const chunk = ids.filter((_, i) => i % N === (k + dayIdx) % N); // har din start rotate
      if (chunk.length) await prisma.trip.updateMany({ where: { id: { in: chunk } }, data: { driver_id: drivers[k].id } });
    }
    dayIdx++;
  }
  console.log("✅ Trips barabar baant diye");
}

async function main() {
  const force = process.argv.includes("--force");

  // Ensure demo logins always carry known credentials (also fixes DBs seeded before these existed)
  const DEMO_ACCOUNTS = [
    { name: "GBS Admin", mobile: "9000000001", role: "ADMIN", email: "admin@gmail.com", password: "admin123" },
    { name: "Mahesh Chauhan", mobile: "9000000002", role: "DRIVER", conductorId: "GJ015500", password: "conductor123" },
    { name: "Baldev Rathod", mobile: "9000000003", role: "DRIVER", conductorId: "GJ015501", password: "conductor123" },
    { name: "Suresh Damor", mobile: "9000000004", role: "DRIVER", conductorId: "GJ015502", password: "conductor123" },
    { name: "Demo Passenger", mobile: "9876543210", role: "PASSENGER", email: "demo@gujaratbusseva.in", password: "demo123" },
  ];
  for (const acc of DEMO_ACCOUNTS) {
    const u = await prisma.user.findUnique({ where: { mobile: acc.mobile } });
    if (u) {
      await prisma.user.update({
        where: { mobile: acc.mobile },
        data: {
          role: acc.role,
          email: acc.email ?? u.email,
          conductor_id: acc.conductorId ?? u.conductor_id,
          password_hash: hashPassword(acc.password),
          ...(acc.conductorId ? { password_plain: acc.password } : {}), // admin ko conductors ka password dikhana hai
        },
      });
    }
  }

  const cityCount = await prisma.city.count();
  const routeCount = await prisma.route.count();
  const busCount = await prisma.bus.count();
  // Auto-reseed when seed data (routes/buses) grows beyond what's in the DB
  const stale = cityCount > 0 && (routeCount !== ROUTE_PAIRS.length * 2 || busCount !== BUSES.length);

  // Conductors: pool hamesha ensure karo + trips barabar baanto (pehle hi seeded DB bhi cover)
  if (cityCount > 0 && !force && !stale) {
    const pool = await ensureConductorPool();
    await rebalanceTrips(pool);
    console.log("ℹ️  Database already seeded — skipping (use `node prisma/seed.js --force` to reset).");
    return;
  }
  if (force || stale) {
    console.log(force ? "♻️  Clearing existing data…" : "♻️  Routes/buses changed — reseeding fresh data…");
    for (const m of ["bookingSeat", "bookingPassenger", "payment", "liveLocation", "review", "booking", "trip", "seat", "bus", "route", "user", "city"]) {
      await prisma[m].deleteMany().catch(() => {});
    }
  }

  console.log("🏙️  Seeding 41 cities…");
  await prisma.city.createMany({
    data: CITIES.map((name, i) => ({ id: i + 1, name, state: "Gujarat", lat: CITY_COORDS[name][0], lng: CITY_COORDS[name][1] })),
  });

  console.log("👥 Seeding users (admin / conductors / passengers)…");
  await prisma.user.create({ data: { name: "GBS Admin", mobile: "9000000001", role: "ADMIN", email: "admin@gmail.com", password_hash: hashPassword("admin123") } });
  const drivers = [];
  for (const c of CONDUCTOR_POOL) {
    drivers.push(await prisma.user.create({ data: { name: c.name, mobile: c.mobile, role: "DRIVER", conductor_id: c.conductorId, password_hash: hashPassword("conductor123"), password_plain: "conductor123" } }));
  }
  await prisma.user.create({ data: { name: "Demo Passenger", mobile: "9876543210", role: "PASSENGER", email: "demo@gujaratbusseva.in", password_hash: hashPassword("demo123") } });
  const passengers = [];
  for (const name of NAMES) {
    passengers.push(await prisma.user.create({
      data: { name, mobile: `98${String(10000000 + rand(89999999)).padStart(8, "0")}`, role: "PASSENGER" },
    }));
  }

  console.log("🚌 Seeding fleet + seat layouts…");
  const busRows = [];
  for (const b of BUSES) {
    const bus = await prisma.bus.create({ data: { ...b, total_seats: BUS_TYPES[b.type].seats } });
    busRows.push(bus);
    await chunkedCreateMany(prisma.seat, seatLayoutFor(b.type).map((s) => ({ ...s, bus_id: bus.id })));
  }
  const seatsByBus = new Map();
  for (const bus of busRows) {
    seatsByBus.set(bus.id, await prisma.seat.findMany({ where: { bus_id: bus.id } }));
  }

  console.log("🛣️  Seeding routes (both directions)…");
  const routeData = [];
  const seen = new Set();
  for (const [a, b, km] of ROUTE_PAIRS) {
    const idA = CITIES.indexOf(a) + 1, idB = CITIES.indexOf(b) + 1;
    for (const [from, to] of [[idA, idB], [idB, idA]]) {
      if (seen.has(`${from}-${to}`)) continue;
      seen.add(`${from}-${to}`);
      routeData.push({ from_city_id: from, to_city_id: to, distance_km: km, base_fare: fareFor("NON_AC_SEATER", km) });
    }
  }
  await chunkedCreateMany(prisma.route, routeData);
  const routes = await prisma.route.findMany();

  console.log("🕒 Seeding trips (yesterday → +4 days)…");
  const SLOT_POOLS = [
    [[5, 45], [9, 30], [13, 0], [17, 15], [22, 30]],
    [[6, 15], [10, 0], [14, 30], [18, 45], [23, 15]],
    [[7, 30], [11, 0], [15, 45], [19, 30], [23, 55]],
    [[8, 0], [12, 0], [16, 30], [20, 45], [21, 45]],
  ];
  const tripData = [];
  for (const route of routes) {
    const pool = SLOT_POOLS[route.id % SLOT_POOLS.length];
    for (let offset = -1; offset <= 4; offset++) {
      const day = localDay(offset);
      const nTrips = 3 + (route.id + offset + 6) % 3; // 3–5 departures per day
      for (let i = 0; i < nTrips; i++) {
        const [h, m] = pool[i];
        const bus = busRows[(route.id + i * 3) % busRows.length];
        const dep = atTime(day, h, m);
        const dur = durationMinFor(bus.type, route.distance_km);
        const status = offset < 0 || (offset === 0 && dep < new Date(Date.now() - 60 * 60000)) ? "COMPLETED" : "SCHEDULED";
        tripData.push({
          route_id: route.id, bus_id: bus.id,
          driver_id: drivers[(route.id + i) % drivers.length].id,
          departure_time: dep, arrival_time: new Date(dep.getTime() + dur * 60000),
          date: day, status, fare: fareFor(bus.type, route.distance_km),
        });
      }
    }
  }
  await chunkedCreateMany(prisma.trip, tripData);

  // One special LIVE trip for instant tracking demo: Ahmedabad → Surat, departed 50 min ago
  console.log("🛰️  Seeding one live trip (Ahmedabad → Surat)…");
  const amdSurat = await prisma.route.findFirst({ where: { fromCity: { name: "Ahmedabad" }, toCity: { name: "Surat" } } });
  const liveBus = busRows[0];
  const liveDep = new Date(Date.now() - 50 * 60000);
  const liveArr = new Date(liveDep.getTime() + durationMinFor(liveBus.type, amdSurat.distance_km) * 60000);
  await prisma.trip.create({
    data: {
      route_id: amdSurat.id, bus_id: liveBus.id, driver_id: drivers[0].id,
      departure_time: liveDep, arrival_time: liveArr, date: localDay(0),
      status: "IN_PROGRESS", fare: fareFor(liveBus.type, amdSurat.distance_km),
    },
  });

  console.log("🎟️  Seeding demo bookings + payments…");
  const allTrips = await prisma.trip.findMany({ include: { bus: true } });
  const usedSeats = new Map(); // tripId -> Set(seatId)
  const bookingsData = [];
  for (let i = 0; i < 90; i++) {
    const trip = pick(allTrips);
    const seats = seatsByBus.get(trip.bus_id);
    if (!usedSeats.has(trip.id)) usedSeats.set(trip.id, new Set());
    const used = usedSeats.get(trip.id);
    const free = seats.filter((s) => !used.has(s.id));
    if (free.length < 1) continue;
    const nPax = 1 + rand(3);
    const chosen = [];
    for (let k = 0; k < Math.min(nPax, free.length); k++) {
      const s = free[rand(free.length)];
      if (!chosen.includes(s)) { chosen.push(s); used.add(s.id); }
    }
    if (!chosen.length) continue;
    const user = pick(passengers);
    const createdAt = new Date(Date.now() - rand(14) * DAY - rand(DAY / 2));
    bookingsData.push({ trip, user, chosen, createdAt });
  }
  for (const { trip, user, chosen, createdAt } of bookingsData) {
    const total = trip.fare * chosen.length;
    const status = Math.random() < 0.08 ? "CANCELLED" : "CONFIRMED";
    const booking = await prisma.booking.create({
      data: {
        pnr: genPnr(), user_id: user.id, trip_id: trip.id,
        total_fare: total, status, created_at: createdAt,
        seats: { create: chosen.map((s) => ({ seat_id: s.id })) },
        passengers: {
          create: chosen.map((s, idx) => ({
            seat_id: s.id, name: idx === 0 ? user.name : pick(NAMES),
            age: 18 + rand(45), gender: pick(["M", "F"]),
          })),
        },
      },
    });
    await prisma.payment.create({
      data: {
        booking_id: booking.id, amount: total, method: "MOCK",
        status: status === "CANCELLED" ? "REFUNDED" : "SUCCESS",
        transaction_id: `pay_seed_${booking.id}`, created_at: createdAt,
      },
    });
  }

  console.log("⭐ Seeding reviews…");
  const reviewData = [];
  for (let i = 0; i < 70; i++) {
    reviewData.push({
      user_id: pick(passengers).id,
      route_id: pick(routes).id,
      rating: 3 + rand(3),
      comment: pick(REVIEW_SNIPPETS),
      created_at: new Date(Date.now() - rand(30) * DAY),
    });
  }
  await chunkedCreateMany(prisma.review, reviewData);

  const counts = {
    cities: await prisma.city.count(), routes: await prisma.route.count(),
    buses: await prisma.bus.count(), seats: await prisma.seat.count(),
    trips: await prisma.trip.count(), bookings: await prisma.booking.count(),
    users: await prisma.user.count(), reviews: await prisma.review.count(),
  };
  console.log("✅ Seed complete:", counts);
  console.log("\n🔑 Demo logins (password-based):");
  console.log("   Passenger: 9876543210 / demo123");
  console.log("   Admin:     admin@gmail.com / admin123");
  console.log("   Conductor: GJ015500 / conductor123\n");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
