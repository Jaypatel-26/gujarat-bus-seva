import { useEffect, useState } from "react";
import { api, busTypeLabel } from "../api";
import { fmtTime, statusLabel, statusTone } from "../lib/format";
import { Page, Badge, EmptyState, Skeleton, LiveDot, Modal } from "../components/ui";
import { toast, useAuth } from "../store";

export default function DriverHome() {
  const { user } = useAuth();
  const [trips, setTrips] = useState(null);
  const [me, setMe] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [manifestTrip, setManifestTrip] = useState(null);
  const [manifest, setManifest] = useState(null);

  const isAdmin = user?.role === "ADMIN";

  const load = () => api("/driver/today").then((d) => setTrips(d.trips)).catch((e) => toast.err(e.message));
  useEffect(() => {
    if (isAdmin) return; // admin ko sirf Manage Conductors dikhana hai — trips load nahi
    load();
    api("/driver/me").then(setMe).catch(() => {});
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
      api("/driver/me").then(setMe).catch(() => {});
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
        <ConductorManager />
      </Page>
    );
  }

  /* ============ CONDUCTOR VIEW — apna profile + trips ============ */
  const c = me?.conductor;

  return (
    <Page className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold md:text-2xl">Conductor Console</h1>
          <p className="text-sm text-slate-500">Namaste, {user?.name?.split(" ")[0] || "Conductor"} 🙏 — aaj ka schedule</p>
        </div>
        <span className="text-3xl">🚍</span>
      </div>

      {/* ---- Conductor details card ---- */}
      {!me ? (
        <Skeleton className="mb-4 h-28 w-full" />
      ) : (
        <div className="card mb-4 overflow-hidden p-0">
          <div className="bg-gradient-to-r from-brand-700 to-brand-900 px-5 py-4 text-white">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 font-display text-lg font-bold ring-2 ring-white/30">
                {(c?.name || user?.name || "C").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              <div className="flex-1">
                <p className="font-display text-lg font-bold leading-tight">{c?.name || user?.name}</p>
                <p className="text-xs text-brand-100">
                  🎫 Conductor{c?.since ? ` • ${new Date(c.since).toLocaleDateString("en-IN", { month: "short", year: "numeric" })} se juda` : ""}
                </p>
              </div>
              {(c?.conductor_id || user?.conductor_id) && (
                <span className="rounded-lg bg-white/15 px-3 py-1.5 font-mono text-sm font-bold tracking-wider ring-1 ring-white/30">{c?.conductor_id || user?.conductor_id}</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 p-4 text-center sm:grid-cols-4">
            <div className="rounded-xl bg-mist p-2.5"><p className="text-lg font-bold text-brand-700">{me.stats.todayTrips}</p><p className="text-[10.5px] font-semibold text-slate-500">Aaj ke trips</p></div>
            <div className="rounded-xl bg-mist p-2.5"><p className="text-lg font-bold text-leaf-700">{me.stats.live}</p><p className="text-[10.5px] font-semibold text-slate-500">Abhi LIVE</p></div>
            <div className="rounded-xl bg-mist p-2.5"><p className="text-lg font-bold text-slate-700">{me.stats.completed}</p><p className="text-[10.5px] font-semibold text-slate-500">Poore kiye</p></div>
            <div className="rounded-xl bg-mist p-2.5"><p className="text-lg font-bold text-slate-700">{c?.mobile || "—"}</p><p className="text-[10.5px] font-semibold text-slate-500">Mobile</p></div>
          </div>
        </div>
      )}

      <div className="mb-4 mt-2 rounded-2xl border border-brand-100 bg-brand-50/60 p-3.5 text-xs leading-relaxed text-brand-700">
        📋 <b>Start Trip</b> dabate hi trip "In progress" ho jata hai aur passengers ko
        station-wise route &amp; timings dikhti hain. Safar poora hone pe <b>Complete</b> dabao.
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

/* ---------- Manage conductors — admin view ka main content ---------- */
function ConductorManager() {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", mobile: "", conductorId: "", password: "" });
  const [busy, setBusy] = useState(false);

  const load = () => api("/admin/drivers").then((d) => setRows(d.drivers)).catch((e) => toast.err(e.message));
  useEffect(() => { load(); }, []);

  const add = async () => {
    setBusy(true);
    try {
      await api("/admin/drivers", { method: "POST", body: form });
      toast.ok(`Conductor added ✅ — login: ${form.conductorId.toUpperCase()} / ${form.password}`);
      setOpen(false);
      setForm({ name: "", mobile: "", conductorId: "", password: "" });
      load();
    } catch (e) { toast.err(e.message); }
    finally { setBusy(false); }
  };

  const del = async (id) => {
    try { await api(`/admin/drivers/${id}`, { method: "DELETE" }); toast.ok("Conductor removed"); load(); }
    catch (e) { toast.err(e.message); }
  };

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-display text-[15px] font-semibold">🎫 Manage Conductors {rows ? <span className="text-xs text-slate-400">({rows.length})</span> : null}</h2>
          <p className="text-xs text-slate-500">Conductor ki puri detail — yahi se add/remove karo</p>
        </div>
        <button className="btn-brand py-1.5 text-xs" onClick={() => setOpen(true)}>+ Add conductor</button>
      </div>

      {!rows ? (
        <Skeleton className="h-28 w-full" />
      ) : rows.length === 0 ? (
        <p className="rounded-lg bg-mist px-3 py-3 text-center text-xs text-slate-500">Koi conductor nahi — "+ Add conductor" se add karo.</p>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-slate-100">
          <table className="w-full min-w-[480px]">
            <thead className="sticky top-0 bg-mist/90"><tr className="text-left"><th className="th">Name</th><th className="th">Conductor ID</th><th className="th">Mobile</th><th className="th">Trips</th><th className="th"></th></tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-t border-slate-50 hover:bg-mist/60">
                  <td className="td font-medium">{d.name}</td>
                  <td className="td font-mono text-xs font-semibold text-brand-700">{d.conductor_id || "—"}</td>
                  <td className="td font-mono text-xs">{d.mobile}</td>
                  <td className="td">{d.trips}</td>
                  <td className="td text-right"><button className="text-xs font-semibold text-danger-600 hover:underline" onClick={() => del(d.id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add conductor">
        <div className="space-y-3">
          <div><label className="label">Full name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Mobile</label><input className="input" maxLength={10} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "") })} /></div>
          <div><label className="label">Conductor ID (login isi se hoga)</label><input className="input font-mono" placeholder="GJ015503" value={form.conductorId} onChange={(e) => setForm({ ...form, conductorId: e.target.value.toUpperCase() })} /></div>
          <div><label className="label">Password</label><input className="input" type="text" placeholder="min 6 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <p className="rounded-lg bg-mist p-2 text-xs text-slate-500">Conductor login page pe 🎫 role chun ke apni <b>Conductor ID + password</b> se login karega.</p>
          <button className="btn-primary w-full" disabled={busy || !form.name || form.mobile.length !== 10 || !/^GJ\d{3,}$/.test(form.conductorId.toUpperCase()) || form.password.length < 6} onClick={add}>
            {busy ? "Saving…" : "Save conductor"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
