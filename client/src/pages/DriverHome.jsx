import { useEffect, useState } from "react";
import { api, busTypeLabel } from "../api";
import { fmtTime, statusLabel, statusTone } from "../lib/format";
import { Page, Badge, EmptyState, Skeleton, LiveDot, Modal } from "../components/ui";
import { toast, useAuth } from "../store";

export default function DriverHome() {
  const { user } = useAuth();
  const [trips, setTrips] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [manifestTrip, setManifestTrip] = useState(null);
  const [manifest, setManifest] = useState(null);

  const load = () => api("/driver/today").then((d) => setTrips(d.trips)).catch((e) => toast.err(e.message));
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  const act = async (trip, action) => {
    setBusyId(trip.id);
    try {
      await api(`/driver/${trip.id}/${action}`, { method: "POST" });
      if (action === "start") toast.ok("Trip started — safe journey! 🚌");
      else toast.info("Trip marked as completed. Great drive! 🏁");
      load();
    } catch (e) { toast.err(e.message); }
    setBusyId(null);
  };

  const openManifest = async (trip) => {
    setManifestTrip(trip);
    setManifest(null);
    try {
      const d = await api(`/driver/${trip.id}/manifest`);
      setManifest(d);
    } catch (e) { toast.err(e.message); setManifestTrip(null); }
  };

  return (
    <Page className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold md:text-2xl">Driver Console</h1>
          <p className="text-sm text-slate-500">Namaste, {user?.name?.split(" ")[0] || "Conductor"} 🙏{user?.conductor_id ? <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-brand-700">{user.conductor_id}</span> : null} — today's schedule</p>
        </div>
        <span className="text-3xl">🚍</span>
      </div>

      <div className="mb-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-3.5 text-xs leading-relaxed text-brand-700">
        📋 <b>Start Trip</b> dabate hi aapka trip "In progress" ho jata hai aur passengers ko
        station-wise route & timings dikhti hain. Safar poora hone pe <b>Complete</b> dabao.
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
                  <button className="btn-ghost" onClick={() => openManifest(t)}>📋 Manifest</button>
                  {t.status === "SCHEDULED" && (
                    <button className="btn-primary" disabled={busyId === t.id} onClick={() => act(t, "start")}>
                      {busyId === t.id ? "Starting…" : "▶ Start Trip"}
                    </button>
                  )}
                  {t.status === "IN_PROGRESS" && (
                    <>
                      <span className="chip animate-pulse bg-leaf-50 text-leaf-700">🚌 Trip in progress…</span>
                      <button className="btn-brand" disabled={busyId === t.id} onClick={() => act(t, "complete")}>
                        {busyId === t.id ? "Finishing…" : "🏁 Complete Trip"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!manifestTrip} onClose={() => setManifestTrip(null)} title={`Boarding List — ${manifestTrip?.route.fromCity.name} → ${manifestTrip?.route.toCity.name}`} maxW="max-w-2xl">
        {!manifest ? (
          <Skeleton className="h-40 w-full" />
        ) : manifest.manifest.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No confirmed passengers yet.</p>
        ) : (
          <>
            <p className="mb-2 text-xs font-semibold text-slate-500">{manifest.total} passengers • verify each by PNR or QR on the e-ticket</p>
            <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-100">
              <table className="w-full">
                <thead className="sticky top-0 bg-white"><tr><th className="th">Seat</th><th className="th">Passenger</th><th className="th">Age/Gender</th><th className="th">PNR</th><th className="th">Contact</th></tr></thead>
                <tbody>
                  {manifest.manifest.map((m, i) => (
                    <tr key={i}>
                      <td className="td"><span className="chip bg-brand-50 text-brand-600">{m.seat}</span></td>
                      <td className="td font-medium">{m.name}</td>
                      <td className="td">{m.age}/{m.gender}</td>
                      <td className="td font-mono text-xs">{m.pnr}</td>
                      <td className="td text-xs">{m.contact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal>
    </Page>
  );
}
