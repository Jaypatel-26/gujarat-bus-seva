import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { fmtTime, fmtDate, inr, statusTone, statusLabel } from "../lib/format";
import { Page, Badge, EmptyState, Modal, Stars, Skeleton } from "../components/ui";
import { toast } from "../store";

const TABS = ["Upcoming", "Past", "Cancelled"];

export default function MyBookings() {
  const [bookings, setBookings] = useState(null);
  const [tab, setTab] = useState("Upcoming");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const load = () => api("/bookings/mine").then((d) => setBookings(d.bookings)).catch((e) => toast.err(e.message));
  useEffect(() => { load(); }, []);

  const now = new Date();
  const filtered = useMemo(() => {
    if (!bookings) return [];
    return bookings.filter((b) => {
      if (tab === "Cancelled") return b.status === "CANCELLED";
      if (tab === "Upcoming") return b.status !== "CANCELLED" && new Date(b.trip.departure_time) > now;
      return b.status !== "CANCELLED" && new Date(b.trip.departure_time) <= now;
    });
  }, [bookings, tab]); // eslint-disable-line

  const doCancel = async () => {
    setCancelling(true);
    try {
      const d = await api(`/bookings/${cancelTarget.pnr}/cancel`, { method: "POST" });
      toast.ok(d.refund ? `Cancelled — ${inr(d.refund)} refund initiated` : "Booking cancelled");
      setCancelTarget(null);
      load();
    } catch (e) { toast.err(e.message); }
    setCancelling(false);
  };

  return (
    <Page className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="font-display text-xl font-bold md:text-2xl">My Bookings</h1>
      <p className="mb-5 text-sm text-slate-500">Upcoming journeys, past trips and cancellations</p>

      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`chip px-4 py-1.5 transition ${tab === t ? "bg-brand-500 text-white" : "bg-white text-slate-500 shadow-soft hover:bg-brand-50"}`}>
            {t}
          </button>
        ))}
      </div>

      {!bookings ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="🎫" title={`No ${tab.toLowerCase()} bookings`} subtitle="Book a bus and your tickets will appear here.">
          <Link to="/" className="btn-primary mt-2">Book a trip</Link>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <BookingCard key={b.pnr} b={b} onCancel={() => setCancelTarget(b)} onReview={() => setReviewTarget(b)} />
          ))}
        </div>
      )}

      {/* cancel modal */}
      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title="Cancel booking?">
        {cancelTarget && (
          <div className="text-sm">
            <p className="text-slate-600">
              {cancelTarget.trip.route.fromCity.name} → {cancelTarget.trip.route.toCity.name} on {fmtDate(cancelTarget.trip.date)}, seats {cancelTarget.seatNumbers.join(", ")}.
            </p>
            {cancelTarget.status === "CONFIRMED" && (
              <p className="mt-2 rounded-xl bg-leaf-50 p-3 font-medium text-leaf-700">
                💸 Refund of {inr(cancelTarget.total_fare)} will be initiated automatically (demo mode).
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setCancelTarget(null)}>Keep booking</button>
              <button className="btn-danger flex-1" disabled={cancelling} onClick={doCancel}>
                {cancelling ? "Cancelling…" : "Yes, cancel it"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* review modal */}
      <ReviewModal target={reviewTarget} onClose={() => setReviewTarget(null)} onDone={() => { setReviewTarget(null); toast.ok("Thanks for the review! ⭐"); }} />
    </Page>
  );
}

function BookingCard({ b, onCancel, onReview }) {
  const t = b.trip, r = t.route;
  const departed = new Date(t.departure_time) < new Date();
  const today = new Date().toDateString() === new Date(t.date).toDateString();
  return (
    <div className="card flex flex-col gap-3 p-4 transition hover:shadow-lift md:flex-row md:items-center">
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-[15px] font-semibold">{r.fromCity.name} → {r.toCity.name}</h3>
          <Badge tone={statusTone(b.status)}>{statusLabel(b.status)}</Badge>
          {t.status === "IN_PROGRESS" && <Badge tone="green">● On the way</Badge>}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {fmtDate(t.date)} • {fmtTime(t.departure_time)} • {t.bus.operator_name}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          PNR <b className="text-slate-500">{b.pnr}</b> • Seats {b.seatNumbers.join(", ")} • {inr(b.total_fare)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {b.status === "PENDING" && <Link className="btn-primary" to={`/checkout/${b.pnr}`}>Pay now</Link>}
        {b.status === "CONFIRMED" && <Link className="btn-ghost" to={`/ticket/${b.pnr}`}>View ticket</Link>}
        {b.status === "CONFIRMED" && <Link className="btn-brand" to={`/trip/${t.id}/route`}>🗺️ Route</Link>}
        {b.status !== "CANCELLED" && !departed && <button className="btn-danger" onClick={onCancel}>Cancel</button>}
        {b.status === "CONFIRMED" && departed && <button className="btn-ghost" onClick={onReview}>⭐ Rate trip</button>}
      </div>
    </div>
  );
}

function ReviewModal({ target, onClose, onDone }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setRating(5); setComment(""); }, [target]);

  const submit = async () => {
    setSaving(true);
    try {
      await api("/reviews", { method: "POST", body: { tripId: target.trip_id, rating, comment } });
      onDone();
    } catch (e) { toast.err(e.message); }
    setSaving(false);
  };

  return (
    <Modal open={!!target} onClose={onClose} title="Rate your trip">
      {target && (
        <div>
          <p className="mb-3 text-sm text-slate-500">
            {target.trip.route.fromCity.name} → {target.trip.route.toCity.name} • {target.trip.bus.operator_name}
          </p>
          <div className="flex justify-center rounded-xl bg-mist py-4">
            <Stars value={rating} onChange={setRating} size={30} />
          </div>
          <textarea className="input mt-3" rows={3} placeholder="How was the journey? (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className="btn-primary mt-3 w-full" disabled={saving} onClick={submit}>{saving ? "Saving…" : "Submit review"}</button>
        </div>
      )}
    </Modal>
  );
}
