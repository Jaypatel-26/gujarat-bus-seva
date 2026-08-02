import { useEffect, useState } from "react";
import { api, busTypeLabel } from "../api";
import { fmtTime, statusLabel, statusTone } from "../lib/format";
import { Page, Badge, EmptyState, Skeleton, LiveDot, Modal } from "../components/ui";
import { toast, useAuth } from "../store";
import ConductorsPanel from "./admin/ConductorsPanel";
import TicketScanner from "../components/TicketScanner";

export default function DriverHome() {
  const { user } = useAuth();
  const [trips, setTrips] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [openList, setOpenList] = useState(null); // jis trip ki passenger list khuli hai
  const [listData, setListData] = useState(null);
  const [scanTrip, setScanTrip] = useState(null);

  const isAdmin = user?.role === "ADMIN";

  const load = () => api("/driver/today").then((d) => setTrips(d.trips)).catch((e) => toast.err(e.message));
  useEffect(() => {
    if (isAdmin) return; // admin ko sirf Manage Conductors dikhana hai
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [isAdmin]);

  const act = async (trip, action) => {
    setBusyId(trip.id);
    try {
      await api(`/driver/${trip.id}/${action}`, { method: "POST" });
      if (action === "start") toast.ok("Trip started — safe journey! 🚌");
      else toast.info("Trip marked as completed. Great job! 🏁");
      load();
    } catch (e) { toast.err(e.message); }
    setBusyId(null);
  };

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

  /* ============ CONDUCTOR VIEW — routes + passenger lists + ticket scanner ============ */
  return (
    <Page className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold md:text-2xl">Conductor Console</h1>
          <p className="text-sm text-slate-500">Namaste, {user?.name?.split(" ")[0] || "Conductor"} 🙏</p>
        </div>
        {user?.conductor_id && (
          <span className="rounded-lg bg-brand-700 px-3 py-1.5 font-mono text-sm font-bold tracking-wider text-white shadow-card">{user.conductor_id}</span>
        )}
      </div>

      <div className="mb-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-3.5 text-xs leading-relaxed text-brand-700">
        📷 <b>Scan Ticket</b> se passenger ki e-ticket ka QR camera me dikhao — sahi trip ki ticket hai to <b>onboard</b> mark ho jayega.
        Har trip ki <b>passenger list</b> uske neeche kholo. Safar shuru hone pe <b>Start Trip</b> dabao.
      </div>

      {!trips ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : trips.length === 0 ? (
        <EmptyState icon="🌤️" title="No trips assigned today" subtitle="Enjoy your day off! New assignments appear here automatically." />
      ) : (
        <div className="space-y-3">
          {trips.map((t) => (
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
                  {t.status === "SCHEDULED" && (
                    <button className="btn-ghost" disabled={busyId === t.id} onClick={() => act(t, "start")}>
                      {busyId === t.id ? "Starting…" : "▶ Start"}
                    </button>
                  )}
                  {t.status === "IN_PROGRESS" && (
                    <button className="btn-brand" disabled={busyId === t.id} onClick={() => act(t, "complete")}>
                      {busyId === t.id ? "Finishing…" : "🏁 Complete"}
                    </button>
                  )}
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
    </Page>
  );
}
