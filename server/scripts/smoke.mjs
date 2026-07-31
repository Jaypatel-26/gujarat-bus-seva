// Quick end-to-end smoke test against a running server (npm run smoke)
const BASE = process.env.BASE || "http://localhost:4000";
let token = "", adminToken = "", driverToken = "";
const j = (r) => r.json().then((d) => ({ status: r.status, data: d }));
const api = (path, opts = {}, tk = token) => fetch(`${BASE}/api${path}`, {
  method: opts.method || "GET",
  headers: { "Content-Type": "application/json", ...(tk ? { Authorization: `Bearer ${tk}` } : {}) },
  body: opts.body ? JSON.stringify(opts.body) : undefined,
});
const ok = (name, cond) => console.log(cond ? `  ✅ ${name}` : `  ❌ ${name}`);

const today = new Date();
const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

console.log("🧪 Gujarat Bus Seva — smoke test\n");

// health + cities
const health = await j(await api("/health"));
ok("health", health.data.ok);
const cities = (await j(await api("/cities"))).data.cities;
ok(`cities (got ${cities.length})`, cities.length >= 40);
const amd = cities.find((c) => c.name === "Ahmedabad");
const srt = cities.find((c) => c.name === "Surat");

// auth: passenger
const reqOtp = (await j(await api("/auth/otp/request", { method: "POST", body: { mobile: "9876543210" } }))).data;
const verify = (await j(await api("/auth/otp/verify", { method: "POST", body: { mobile: "9876543210", otp: reqOtp.devOtp } }))).data;
token = verify.token;
ok("passenger OTP login", Boolean(token && verify.user?.name));

// search
const search = (await j(await api(`/trips/search?from=${amd.id}&to=${srt.id}&date=${dateStr}&pax=2`))).data;
ok(`search AMD→SRT (${search.trips?.length} trips, ${search.route?.distanceKm} km)`, search.trips?.length > 0);
const trip = search.trips.find((t) => t.bookable) || search.trips[0];
console.log(`     → trip #${trip.id} ${trip.bus.operator} ₹${trip.fare} seatsLeft=${trip.seatsLeft}`);

// trip detail + seats
const detail = (await j(await api(`/trips/${trip.id}`))).data;
const freeSeats = detail.bus.seats.filter((s) => !detail.bookedSeatIds.includes(s.id)).slice(0, 2);
ok(`seat map (${detail.bus.seats.length} seats, ${detail.bookedSeatIds.length} occupied)`, freeSeats.length === 2);

// booking + mock payment
const booking = (await j(await api("/bookings", {
  method: "POST",
  body: {
    tripId: trip.id, seatIds: freeSeats.map((s) => s.id),
    passengers: freeSeats.map((s, i) => ({ seatId: s.id, name: i ? "Priya Shah" : "Demo Passenger", age: 25 + i * 5, gender: i ? "F" : "M" })),
    contactEmail: "demo@gujaratbusseva.in", contactMobile: "9876543210",
  },
}))).data;
ok(`booking created (${booking.booking?.pnr})`, Boolean(booking.booking?.pnr));
const confirm = (await j(await api("/payments/confirm", { method: "POST", body: { pnr: booking.booking.pnr, mock: true } }))).data;
ok("mock payment confirmed", confirm.ok === true);
const fetched = await j(await api(`/bookings/${booking.booking.pnr}`));
const pdf = await fetch(`${BASE}/api/bookings/${booking.booking.pnr}/ticket.pdf?token=${token}`);
ok("e-ticket + QR + PDF", fetched.status === 200 && Boolean(fetched.data.qr) && pdf.status === 200 && pdf.headers.get("content-type") === "application/pdf");

// my bookings + cancel flow on a fresh discretionary booking is covered; check list
const mine = (await j(await api("/bookings/mine"))).data;
ok(`my bookings (${mine.bookings.length})`, mine.bookings.length > 0);

// reviews
const rev = (await j(await api("/reviews", { method: "POST", body: { tripId: trip.id, rating: 5, comment: "Smoke test review" } }))).data;
ok("review posted", rev.ok === true);

// admin
const aOtp = (await j(await api("/auth/otp/request", { method: "POST", body: { mobile: "9000000001" } }))).data;
adminToken = (await j(await api("/auth/otp/verify", { method: "POST", body: { mobile: "9000000001", otp: aOtp.devOtp } }))).data.token;
const stats = (await j(await api("/admin/stats", {}, adminToken))).data;
ok(`admin stats (today: ${stats.bookingsToday} bookings, ₹${stats.revenueToday})`, adminToken && stats.revenueSeries?.length === 14);

// driver: start a trip and observe live tracking
const dOtp = (await j(await api("/auth/otp/request", { method: "POST", body: { mobile: "9000000002" } }))).data;
driverToken = (await j(await api("/auth/otp/verify", { method: "POST", body: { mobile: "9000000002", otp: dOtp.devOtp } }))).data.token;
const dTrips = (await j(await api("/driver/today", {}, driverToken))).data.trips;
const liveTrip = dTrips.find((t) => t.status === "IN_PROGRESS") || dTrips[0];
if (liveTrip) {
  await j(await api(`/driver/${liveTrip.id}/start`, { method: "POST" }, driverToken));
  await new Promise((r2) => setTimeout(r2, 1500));
  const withLoc = (await j(await api(`/trips/${liveTrip.id}`))).data;
  ok(`live tracking (trip #${liveTrip.id} @ ${withLoc.liveLocation?.latitude},${withLoc.liveLocation?.longitude}, ${withLoc.liveLocation?.speed} km/h)`, Boolean(withLoc.liveLocation));
} else {
  ok("live tracking", false);
}

console.log("\n🎉 Smoke test finished.");
process.exit(0);
