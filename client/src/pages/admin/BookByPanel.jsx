import { Fragment, useEffect, useState } from "react";
import { api } from "../../api";
import { fmtDate, inr, statusTone, statusLabel } from "../../lib/format";
import { Badge, Skeleton, EmptyState } from "../../components/ui";
import { Search } from "lucide-react";

/* 📇 Book By list — JISNE booking ki (account): name, mobile, email.
   Row pe click karo → us booker ki saari bookings aur unke seat-time passengers
   (name, age, mobile, email) khul jaate hain. Passengers list alag — bookings tab me. */
export default function BookByPanel() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [expand, setExpand] = useState(null); // booker id jo khula hai

  const load = () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    return api(`/admin/bookers?${params}`).then((d) => setRows(d.bookers)).catch(() => {});
  };
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t); // eslint-disable-line
  }, [q]);

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-[15px] font-semibold">
            📇 Book By {rows ? <span className="text-xs text-slate-400">({rows.length})</span> : null}
          </h2>
          <p className="text-xs text-slate-500">
            Jis <b>account</b> ne booking ki — uska <b>name, mobile, email</b>. Row pe click karo → uski bookings aur asli passengers dikhenge (seat time wale).
          </p>
        </div>
        <div className="input flex w-60 items-center gap-2 py-1.5">
          <Search size={14} className="text-slate-400" />
          <input className="w-full bg-transparent text-xs outline-none" placeholder="name / mobile / email" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {!rows ? (
        <Skeleton className="h-28 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon="📇" title="Koi booker nahi mila" subtitle={q ? "Doosra search try karo." : "Jab koi booking karega to yaha dikhega."} />
      ) : (
        <div className="max-h-[62vh] overflow-auto rounded-xl border border-slate-100">
          <table className="w-full min-w-[720px]">
            <thead className="sticky top-0 z-10 bg-mist/90">
              <tr className="text-left">
                <th className="th">Name</th><th className="th">Mobile</th><th className="th">Email</th>
                <th className="th">Bookings</th><th className="th">Passengers</th><th className="th">Total spent</th><th className="th">Last booking</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <Fragment key={u.id}>
                  <tr className={`cursor-pointer border-t border-slate-50 transition hover:bg-brand-50/60 ${expand === u.id ? "bg-brand-50/40" : ""}`} onClick={() => setExpand(expand === u.id ? null : u.id)}>
                    <td className="td font-medium">
                      <span className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-900 text-[11px] font-bold text-white">
                          {(u.name || "B").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                        </span>
                        {u.name}
                        <span className="text-[10px] text-slate-300">{expand === u.id ? "▲" : "▼"}</span>
                      </span>
                    </td>
                    <td className="td font-mono text-xs">{u.mobile}</td>
                    <td className="td text-xs">{u.email || "—"}</td>
                    <td className="td"><span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">{u.bookings}</span></td>
                    <td className="td">{u.passengers}</td>
                    <td className="td font-semibold">{inr(u.spent)}</td>
                    <td className="td text-xs">{u.lastBooking ? fmtDate(u.lastBooking) : "—"}</td>
                  </tr>
                  {expand === u.id && (
                    <tr className="border-t border-slate-50">
                      <td colSpan={7} className="bg-mist/40 px-4 py-3">
                        <p className="label !mb-2">{u.name} ki bookings ({u.recent.length}{u.bookings > u.recent.length ? ` of ${u.bookings}` : ""})</p>
                        <div className="space-y-2">
                          {u.recent.map((b) => (
                            <div key={b.pnr} className="rounded-xl border border-slate-100 bg-white p-3">
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-mono font-bold text-brand-600">{b.pnr}</span>
                                <Badge tone={statusTone(b.status)}>{statusLabel(b.status)}</Badge>
                                <span className="font-medium">{b.route}</span>
                                <span className="text-slate-400">{fmtDate(b.date)} • {b.bus} • Seats {b.seats}</span>
                                <span className="ml-auto font-semibold">{inr(b.total)}</span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {b.passengers.map((p, i) => (
                                  <span key={i} className="chip bg-brand-50 text-[11px] font-medium text-brand-700">
                                    {p.name} ({p.age}/{p.gender}){p.mobile ? ` • 📞 ${p.mobile}` : ""}{p.email ? ` • ✉ ${p.email}` : ""}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[11px] text-slate-400">💡 Asli <b>passengers</b> (seat book karte waqt likhe gaye) — <b>Bookings</b> page ke PASSENGER column me dikhte hain, ya upar kisi bhi booker ko khol ke.</p>
    </div>
  );
}
