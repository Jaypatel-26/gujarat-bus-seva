import { useEffect, useState } from "react";
import { api, API } from "../../api";
import { fmtDate, inr, statusTone, statusLabel } from "../../lib/format";
import { Badge, Skeleton, EmptyState } from "../../components/ui";
import { useAuth } from "../../store";
import { FileDown, Search } from "lucide-react";

export default function BookingsAdmin() {
  const { token } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState(null);

  const load = () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    api(`/admin/bookings?${params}`).then((d) => setRows(d.bookings));
  };
  useEffect(() => { setRows(null); const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, status]); // eslint-disable-line

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-[15px] font-semibold">All bookings {rows && <span className="text-xs font-normal text-slate-400">({rows.length})</span>}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="input flex w-52 items-center gap-2 py-1.5">
            <Search size={14} className="text-slate-400" />
            <input className="w-full bg-transparent text-xs outline-none" placeholder="PNR / name / mobile" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input w-36 py-1.5 text-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All status</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PENDING">Pending</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <a className="btn-brand py-1.5 text-xs" href={`${API}/api/admin/bookings.csv?token=${token}`}>
            <FileDown size={13} /> Export CSV
          </a>
        </div>
      </div>

      {!rows ? <Skeleton className="h-72 w-full" /> : rows.length === 0 ? (
        <EmptyState icon="🧾" title="No bookings found" subtitle="Try a different search or filter." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead><tr><th className="th">PNR</th><th className="th">Passenger</th><th className="th">Route</th><th className="th">Journey</th><th className="th">Seats</th><th className="th">Fare</th><th className="th">Payment</th><th className="th">Status</th></tr></thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.pnr} className="hover:bg-mist/60">
                  <td className="td font-mono text-xs font-semibold">{b.pnr}</td>
                  <td className="td">
                    {b.passengers?.length ? (
                      <span title={b.passengers.map((p) => `${p.name} — ${p.age}yr/${p.gender}, 📞 ${p.mobile || "—"}${p.email ? `, ✉ ${p.email}` : ""}`).join("\n")}>
                        <span className="block font-medium">
                          {b.passengers[0].name}
                          {b.passengers.length > 1 && <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-600">+{b.passengers.length - 1}</span>}
                        </span>
                        <span className="block text-[11px] text-slate-400">
                          {b.passengers[0].age} yrs • {b.passengers[0].mobile ? `📞 ${b.passengers[0].mobile}` : "📞 —"}
                        </span>
                        {b.passengers[0].email && <span className="block text-[11px] text-slate-400">✉ {b.passengers[0].email}</span>}
                      </span>
                    ) : (
                      <span><span className="block font-medium">{b.user}</span><span className="text-[11px] text-slate-400">{b.mobile}</span></span>
                    )}
                  </td>
                  <td className="td">{b.route}</td>
                  <td className="td text-xs">{fmtDate(b.date)}</td>
                  <td className="td text-xs">{b.seats}</td>
                  <td className="td font-semibold">{inr(b.total)}</td>
                  <td className="td text-xs">{b.payment ? `${b.payment.method} • ${b.payment.status}` : "—"}</td>
                  <td className="td"><Badge tone={statusTone(b.status)}>{statusLabel(b.status)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
