import { useEffect, useMemo, useState } from "react";
import { api, busTypeLabel, API } from "../api";
import { fmtTime, statusLabel, statusTone } from "../lib/format";
import { Page, Badge, EmptyState, Skeleton, LiveDot, Modal } from "../components/ui";
import { toast, useAuth } from "../store";
import ConductorsPanel from "./admin/ConductorsPanel";
import TicketScanner from "../components/TicketScanner";
import ConductorProfile from "../components/ConductorProfile";

export default function DriverHome() {
  const { user, token } = useAuth();
  const [trips, setTrips] = useState(null);
  const [q, setQ] = useState("");
  const [openList, setOpenList] = useState(null); // jis trip ki passenger list khuli hai
  const [listData, setListData] = useState(null);
  const [scanTrip, setScanTrip] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const isAdmin = user?.role === "ADMIN";

  const load = () => api("/driver/today").then((d) => setTrips(d.trips)).catch((e) => toast.err(e.message));
  useEffect(() => {
    if (isAdmin) return; // admin ko sirf Manage Conductors dikhana hai
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [isAdmin]);

  const filtered = useMemo(() => {
    if (!trips) return null;
    const s = q.trim().toLowerCase();
    if (!s) return trips;
    return trips.filter((t) =>
      t.route.fromCity.name.toLowerCase().includes(s) ||
      t.route.toCity.name.toLowerCase().includes(s) ||
      `${t.route.fromCity.name} ${t.route.toCity.name}`.toLowerCase().includes(s) ||
      t.bus.bus_number.toLowerCase().includes(s)
    );
  }, [trips, q]);

  const loadList = async (tripId) => {
    setListData(null);
    try { setListData(await api(`/driver/${tripId}/manifest`)); }
    catch (e) { toast.err(e.message); setOpenList(null); }
  };
  const toggleList = (trip) => {
    if (openList === trip.id) { setOpenList(null); return; }
    setOpenList(trip.id);
    loadList(trip.id);
  };

  /* ============ ADMIN VIEW — sirf Manage Conductors ============ */
  if (isAdmin) {
    return (
      <Page className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold md:text-2xl">Conductor Console</h1>
            <p className="text-sm text-slate-500">Saare conductors yaha manage karo 🎫</p>
          </div>
          <span className="text-3xl">🚍</span>
        </div>
        <ConductorsPanel />
      </Page>
    );
  }

  /* ============ CONDUCTOR VIEW — routes search + passenger lists + scanner + PDF ============ */
  return (
    <Page className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setProfileOpen(true)} className="group relative shrink-0" title="My Profile kholo">
            <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-600 to-brand-900 font-display text-lg font-bold text-white shadow-card ring-2 ring-brand-200 transition group-hover:ring-saffron-400">
              {user?.photo_url ? <img src={user.photo_url} alt="me" className="h-full w-full object-cover" /> : (user?.name || "C").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] shadow-card">✏️</span>
          </button>
          <div>
            <h1 className="font-display text-xl font-bold md:text-2xl">Conductor Console</h1>
            <p className="text-sm text-slate-500">Namaste, {user?.name?.split(" ")[0] || "Conductor"} 🙏</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost !py-1.5 text-xs" onClick={() => setProfileOpen(true)}>👤 My Profile</button>
          {user?.conductor_id && (
            <span className="rounded-lg bg-brand-700 px-3 py-1.5 font-mono text-sm font-bold tracking-wider text-white shadow-card">{user.conductor_id}</span>
          )}
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-3.5 text-xs leading-relaxed text-brand-700">
        📷 <b>Scan Ticket</b> se passenger ki e-ticket ka QR camera me dikhao — sahi trip ki ticket hai to <b>onboard</b> mark ho jayega.
        Har trip ki <b>passenger list</b> kholo aur <b>⬇ PDF</b> se download bhi kar sakte ho.
      </div>

      {/* ---- route search ---- */}
      <div className="relative mb-4">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        <input
          className="input !pl-10"
          placeholder="Route dhundo — city ka naam ya bus number likho (e.g. Surat, GJ-27…)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {!filtered ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        q ? (
          <EmptyState icon="🔍" title={`"${q}" ke liye koi route nahi mila`} subtitle="Doosri city ka naam try karo, ya search box khali kar do." />
        ) : (
          <EmptyState icon="🌤️" title="No trips assigned today" subtitle="Enjoy your day off! New assignments appear here automatically." />
        )
      ) : (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-slate-400">{filtered.length} trip{filtered.length !== 1 ? "s" : ""} {q ? `“${q}” ke liye` : "aaj"}</p>
          {filtered.map((t) => (
            <div key={t.id} className="card p-4 transition hover:shadow-lift">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-[15px] font-semibold">{t.route.fromCity.name} → {t.route.toCity.name}</h3>
                    {t.status === "IN_PROGRESS" ? <Badge tone="green"><LiveDot /> LIVE</Badge> : <Badge tone={statusTone(t.status)}>{statusLabel(t.status)}</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {fmtTime(t.departure_time)} → {fmtTime(t.arrival_time)} • {t.bus.bus_number} ({busTypeLabel(t.bus.type)})
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">👥 {t._count.bookings} booking{t._count.bookings !== 1 ? "s" : ""} on this trip</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className={`btn-ghost ${openList === t.id ? "!bg-brand-100" : ""}`} onClick={() => toggleList(t)}>
                    👥 Passengers {openList === t.id ? "▲" : "▼"}
                  </button>
                  <button className="btn-primary !bg-brand-700" onClick={() => setScanTrip(t)}>📷 Scan Ticket</button>
                  <a
                    className="btn-ghost"
                    href={`${API}/api/driver/${t.id}/manifest.pdf?token=${token}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Passenger list PDF download"
                  >
                    ⬇ PDF
                  </a>
                </div>
              </div>

              {/* ---- inline passenger list ---- */}
              {openList === t.id && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  {!listData ? (
                    <Skeleton className="h-20 w-full" />
                  ) : (
                    <>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-500">{listData.total} passengers • PNR/QR se verify karo</p>
                        <span className="chip bg-leaf-50 font-bold text-leaf-700">✓ {listData.boarded}/{listData.total} onboard</span>
                      </div>
                      {listData.manifest.length === 0 ? (
                        <p className="rounded-lg bg-mist px-3 py-3 text-center text-xs text-slate-400">Abhi koi confirmed passenger nahi.</p>
                      ) : (
                        <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-100">
                          <table className="w-full min-w-[480px]">
                            <thead className="sticky top-0 bg-mist/90"><tr className="text-left"><th className="th">Seat</th><th className="th">Passenger</th><th className="th">Age/G</th><th className="th">PNR</th><th className="th">Contact</th><th className="th">Status</th></tr></thead>
                            <tbody>
                              {listData.manifest.map((m, i) => (
                                <tr key={i} className={`border-t border-slate-50 ${m.checked ? "bg-leaf-50/50" : ""}`}>
                                  <td className="td"><span className="chip bg-brand-50 text-brand-600">{m.seat}</span></td>
                                  <td className="td font-medium">{m.name}</td>
                                  <td className="td text-xs">{m.age}/{m.gender}</td>
                                  <td className="td font-mono text-xs">{m.pnr}</td>
                                  <td className="td text-xs">{m.contact}</td>
                                  <td className="td">{m.checked ? <span className="chip bg-leaf-100 font-bold text-leaf-700">✓ Onboard</span> : <span className="text-[11px] text-slate-400">—</span>}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ---- SCANNER MODAL ---- */}
      <Modal open={!!scanTrip} onClose={() => { setScanTrip(null); if (openList) loadList(openList); }} title="📷 E-Ticket Scanner" maxW="max-w-lg">
        {scanTrip && <TicketScanner trip={scanTrip} onChanged={() => { if (openList) loadList(openList); load(); }} />}
      </Modal>

      {/* ---- MY PROFILE MODAL ---- */}
      <Modal open={profileOpen} onClose={() => setProfileOpen(false)} title="👤 My Profile" maxW="max-w-md">
        {profileOpen && <ConductorProfile onClose={() => setProfileOpen(false)} />}
      </Modal>
    </Page>
  );
}
