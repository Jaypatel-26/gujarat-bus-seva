import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api, busTypeLabel } from "../api";
import { fmtTime, fmtDate, minsToText, inr } from "../lib/format";
import { Page, Badge, Stars, Skeleton, EmptyState } from "../components/ui";
import SeatMap from "../components/SeatMap";
import { toast, useAuth } from "../store";

const BOARDING_POINTS = (city) => [
  `${city} — Central Bus Station`, `${city} — ST Depot`, `${city} — Railway Station Road`,
];

export default function Seats() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const loc = useLocation();
  const { token, user } = useAuth();
  const paxLimit = Math.min(6, Number(params.get("pax")) || 6);

  const [trip, setTrip] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Map()); // seatId -> seat
  const [passengers, setPassengers] = useState({}); // seatId -> {name, age, gender}
  const [boarding, setBoarding] = useState("");
  const [contactMobile, setContactMobile] = useState(user?.mobile || "");
  const [contactEmail, setContactEmail] = useState(user?.email || "");
  const [submitting, setSubmitting] = useState(false);

  const load = () =>
    api(`/trips/${id}`).then(setTrip).catch((e) => setError(e.message));
  useEffect(() => { setTrip(null); load(); /* eslint-disable-next-line */ }, [id]);

  useEffect(() => {
    if (trip) setBoarding((b) => b || BOARDING_POINTS(trip.route.fromCity.name)[0]);
  }, [trip]);

  const occupied = useMemo(() => new Set(trip?.bookedSeatIds || []), [trip]);

  const toggle = (seat) => {
    if (occupied.has(seat.id)) return;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(seat.id)) next.delete(seat.id);
      else if (next.size >= paxLimit) { toast.err(`Maximum ${paxLimit} seat${paxLimit > 1 ? "s" : ""} for this search`); return prev; }
      else next.set(seat.id, seat);
      return next;
    });
  };

  const selArr = [...selected.values()];
  const total = (trip?.fare || 0) * selArr.length;

  const setPax = (seatId, field, value) =>
    setPassengers((p) => ({ ...p, [seatId]: { gender: "M", age: "", name: "", ...p[seatId], [field]: value } }));

  const proceed = async () => {
    if (!selArr.length) return toast.err("Select at least one seat");
    for (const s of selArr) {
      const p = passengers[s.id] || {};
      if (!p.name?.trim() || !p.age || Number(p.age) < 1) {
        return toast.err(`Fill name & age for seat ${s.seat_number}`);
      }
    }
    setSubmitting(true);
    try {
      const body = {
        tripId: trip.id,
        seatIds: selArr.map((s) => s.id),
        passengers: selArr.map((s) => ({ seatId: s.id, name: passengers[s.id].name.trim(), age: Number(passengers[s.id].age), gender: passengers[s.id].gender || "M" })),
        contactEmail: contactEmail || undefined,
        contactMobile: contactMobile || undefined,
      };
      const d = await api("/bookings", { method: "POST", body });
      toast.ok(`Seats locked — PNR ${d.booking.pnr}`);
      nav(`/checkout/${d.booking.pnr}`);
    } catch (e) {
      toast.err(e.message);
      if (e.status === 409) { setSelected(new Map()); load(); }
    } finally {
      setSubmitting(false);
    }
  };

  if (error) return <Page className="mx-auto max-w-5xl px-4 py-8"><EmptyState icon="😕" title="Couldn't load this trip" subtitle={error} /></Page>;

  if (!trip) {
    return (
      <Page className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-5 lg:grid-cols-[1.5fr,1fr]">
          <div className="card p-5 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
          <div className="card p-5"><Skeleton className="h-64 w-full" /></div>
        </div>
      </Page>
    );
  }

  const r = trip.route;
  const departed = new Date(trip.departure_time) < new Date();

  return (
    <Page className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold md:text-2xl">{r.fromCity.name} <span className="text-saffron-600">→</span> {r.toCity.name}</h1>
          <p className="text-sm text-slate-500">{fmtDate(trip.date)} • Depart {fmtTime(trip.departure_time)} • {minsToText((new Date(trip.arrival_time) - new Date(trip.departure_time)) / 60000)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="blue">{busTypeLabel(trip.bus.type)}</Badge>
          <Link to={`/trip/${trip.id}/route`}><Badge tone="slate">🗺️ Route & timings</Badge></Link>
        </div>
      </div>

      {departed && <div className="card mb-4 border-l-4 border-danger bg-danger-50 p-4 text-sm font-medium text-danger-600">This bus has already departed. Please pick another trip.</div>}

      <div className="grid gap-5 lg:grid-cols-[1.5fr,1fr]">
        {/* LEFT: seat map + bus info + reviews */}
        <div className="space-y-5">
          <div className="card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-display text-[15px] font-semibold">{trip.bus.operator_name}</h2>
                <p className="text-xs text-slate-400">{trip.bus.bus_number} {trip.driver?.name ? `• Driver: ${trip.driver.name}` : ""}</p>
              </div>
              {trip.rating?.count > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Stars value={trip.rating.avg} size={13} />
                  <b>{trip.rating.avg}</b> <span className="text-xs text-slate-400">({trip.rating.count} reviews)</span>
                </div>
              )}
            </div>
            <SeatMap
              seats={trip.bus.seats}
              busType={trip.bus.type}
              occupied={occupied}
              selected={new Set(selected.keys())}
              onToggle={(seat) => toggle(seat)}
              maxSelectable={paxLimit}
            />
          </div>

          {trip.reviews?.length > 0 && (
            <div className="card p-5">
              <h3 className="mb-3 font-display text-sm font-semibold text-slate-600">Recent reviews on this route</h3>
              <div className="space-y-3">
                {trip.reviews.slice(0, 3).map((rev) => (
                  <div key={rev.id} className="rounded-xl bg-mist p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{rev.user?.name || "Traveller"}</span>
                      <Stars value={rev.rating} size={11} />
                    </div>
                    <p className="mt-1 text-[13px] text-slate-500">{rev.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: summary + passengers */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="card p-5">
            <h3 className="font-display text-[15px] font-semibold">Trip Summary</h3>
            <div className="mt-3 space-y-1.5 text-sm text-slate-600">
              <p className="flex justify-between"><span>Route</span><b>{r.fromCity.name} → {r.toCity.name}</b></p>
              <p className="flex justify-between"><span>Distance</span><b>{r.distance_km} km</b></p>
              <p className="flex justify-between"><span>Fare / seat</span><b>{inr(trip.fare)}</b></p>
            </div>

            <div className="mt-4">
              <p className="label">Boarding point</p>
              <select className="input" value={boarding} onChange={(e) => setBoarding(e.target.value)}>
                {BOARDING_POINTS(r.fromCity.name).map((bp) => <option key={bp} value={bp}>{bp}</option>)}
              </select>
            </div>

            <div className="mt-4">
              <p className="label">Selected seats ({selArr.length}/{paxLimit})</p>
              <div className="flex min-h-[38px] flex-wrap gap-2">
                {selArr.length === 0 && <span className="text-sm text-slate-400">Tap seats on the map to select</span>}
                <AnimatePresence>
                  {selArr.map((s) => (
                    <motion.span key={s.id} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }}
                      className="chip bg-leaf-50 text-leaf-700">
                      {s.seat_number}
                      <button onClick={() => toggle(s)} className="ml-0.5 opacity-60 hover:opacity-100">✕</button>
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <AnimatePresence>
              {selArr.length > 0 && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-4 space-y-3 border-t border-dashed border-slate-200 pt-4">
                    <p className="label">Passenger details</p>
                    {selArr.map((s) => (
                      <div key={s.id} className="rounded-xl border border-slate-100 bg-mist/60 p-3">
                        <p className="mb-2 text-xs font-bold text-brand-600">Seat {s.seat_number}</p>
                        <div className="grid grid-cols-[1fr,70px,86px] gap-2">
                          <input className="input py-2" placeholder="Full name" value={passengers[s.id]?.name || ""} onChange={(e) => setPax(s.id, "name", e.target.value)} />
                          <input className="input py-2" placeholder="Age" type="number" min="1" max="100" value={passengers[s.id]?.age || ""} onChange={(e) => setPax(s.id, "age", e.target.value)} />
                          <select className="input py-2" value={passengers[s.id]?.gender || "M"} onChange={(e) => setPax(s.id, "gender", e.target.value)}>
                            <option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
                          </select>
                        </div>
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-2">
                      <input className="input py-2" placeholder="Contact mobile" value={contactMobile} onChange={(e) => setContactMobile(e.target.value)} />
                      <input className="input py-2" placeholder="Email (optional)" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-sm text-slate-500">Total payable</span>
              <span className="font-display text-2xl font-bold text-brand-600">{inr(total)}</span>
            </div>

            {!token ? (
              <button className="btn-primary mt-3 w-full" onClick={() => nav(`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`)}>
                Login to continue →
              </button>
            ) : (
              <button className="btn-primary mt-3 w-full" disabled={!selArr.length || submitting || departed} onClick={proceed}>
                {submitting ? "Locking your seats…" : `Proceed to Pay ${total ? inr(total) : ""}`}
              </button>
            )}
            <p className="mt-2 text-center text-[11px] text-slate-400">Seats are held for 15 minutes while you pay 🔒</p>
          </div>
        </div>
      </div>
    </Page>
  );
}
