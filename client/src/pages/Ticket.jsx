import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Download, Radar, Armchair } from "lucide-react";
import { api, API, busTypeLabel } from "../api";
import { fmtTime, fmtDate, inr } from "../lib/format";
import { Page, Badge, Skeleton, EmptyState } from "../components/ui";
import { useAuth } from "../store";

export default function Ticket() {
  const { pnr } = useParams();
  const nav = useNavigate();
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/bookings/${pnr}`).then(setData).catch((e) => setError(e.message));
  }, [pnr]);

  if (error) return <Page className="mx-auto max-w-3xl px-4 py-8"><EmptyState icon="🎫" title="Ticket not found" subtitle={error} /></Page>;
  if (!data) return <Page className="mx-auto max-w-3xl px-4 py-8"><Skeleton className="h-96 w-full" /></Page>;

  const { booking: b, qr } = data;
  const t = b.trip, r = t.route;

  if (b.status === "PENDING") {
    return (
      <Page className="mx-auto max-w-3xl px-4 py-8">
        <EmptyState icon="⏳" title="Payment pending" subtitle="Complete the payment to confirm your seats.">
          <button className="btn-primary mt-2" onClick={() => nav(`/checkout/${pnr}`)}>Go to payment →</button>
        </EmptyState>
      </Page>
    );
  }

  const canTrack = new Date(t.date) >= new Date(new Date().toDateString()) && b.status === "CONFIRMED";

  return (
    <Page className="mx-auto max-w-3xl px-4 py-6">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 14 }}
        className="mx-auto mb-5 flex flex-col items-center text-center"
      >
        <span className={`flex h-16 w-16 items-center justify-center rounded-full text-3xl ${b.status === "CONFIRMED" ? "bg-leaf-50" : "bg-danger-50"}`}>
          {b.status === "CONFIRMED" ? "✅" : "✖️"}
        </span>
        <h1 className="mt-3 font-display text-2xl font-bold">
          {b.status === "CONFIRMED" ? "Booking Confirmed!" : "Booking Cancelled"}
        </h1>
        <p className="text-sm text-slate-500">
          {b.status === "CONFIRMED"
            ? `E-ticket sent to ${b.contact_email || b.contact_mobile || "your account"}`
            : `Refund of ${inr(b.total_fare)} will reflect in 3–5 business days (demo).`}
        </p>
      </motion.div>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="card overflow-hidden">
        <div className="flex items-center justify-between bg-gradient-to-r from-brand-600 to-brand-800 px-5 py-4 text-white">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-brand-200">Gujarat Bus Seva • E-Ticket</p>
            <p className="font-display text-lg font-bold">{r.fromCity.name} → {r.toCity.name}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-brand-200">PNR</p>
            <p className="font-display text-lg font-bold text-saffron-400">{b.pnr}</p>
          </div>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-[1.4fr,1fr]">
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Cell label="Journey Date" value={fmtDate(t.date)} />
            <Cell label="Departure" value={fmtTime(t.departure_time)} />
            <Cell label="Reporting Time" value={fmtTime(new Date(new Date(t.departure_time) - 15 * 60000))} />
            <Cell label="Arrival (est.)" value={fmtTime(t.arrival_time)} />
            <Cell label="Operator" value={t.bus.operator_name} />
            <Cell label="Bus" value={`${t.bus.bus_number} • ${busTypeLabel(t.bus.type)}`} />
            <Cell label="Seats" value={b.seatNumbers.join(", ")} />
            <Cell label="Total Fare" value={inr(b.total_fare)} highlight />
          </div>

          <div className="flex flex-col items-center justify-center rounded-2xl bg-mist p-4">
            {b.status === "CONFIRMED" ? (
              <>
                <img src={qr} alt="Ticket QR" className="h-36 w-36 rounded-lg bg-white p-2 shadow-soft" />
                <p className="mt-2 text-center text-[11px] text-slate-400">Show this QR while boarding</p>
              </>
            ) : (
              <Badge tone="red">Cancelled</Badge>
            )}
          </div>
        </div>

        <div className="border-t border-dashed border-slate-200 px-5 py-4">
          <p className="label">Passengers</p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">Name</th><th className="th">Age</th><th className="th">Gender</th><th className="th">Seat</th></tr></thead>
              <tbody>
                {b.passengers.map((p) => (
                  <tr key={p.id}>
                    <td className="td font-medium">{p.name}</td>
                    <td className="td">{p.age}</td>
                    <td className="td">{p.gender}</td>
                    <td className="td"><span className="chip bg-brand-50 text-brand-600"><Armchair size={11} /> {p.seat_number}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-mist/50 px-5 py-4">
          {b.status === "CONFIRMED" && (
            <>
              <a className="btn-brand" href={`${API}/api/bookings/${b.pnr}/ticket.pdf?token=${token}`} target="_blank" rel="noreferrer">
                <Download size={15} /> Download PDF
              </a>
              <Link className="btn-primary" to={`/trip/${t.id}/route`}><Radar size={15} /> Full Route & Timings</Link>
            </>
          )}
          <Link className="btn-ghost ml-auto" to="/bookings">My Bookings</Link>
        </div>
      </motion.div>

      <p className="mt-4 text-center text-xs text-slate-400">Carry a valid Govt. photo ID while travelling. Helpline 1800-419-0001</p>
    </Page>
  );
}

const Cell = ({ label, value, highlight }) => (
  <div>
    <p className="label mb-0.5">{label}</p>
    <p className={`font-semibold ${highlight ? "font-display text-lg text-brand-600" : ""}`}>{value}</p>
  </div>
);
