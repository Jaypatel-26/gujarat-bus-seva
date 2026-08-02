import { useEffect, useState } from "react";
import { api, loadCities, busTypeLabel } from "../../api";
import { fmtTime, todayStr, inr } from "../../lib/format";
import { Badge, Modal, Skeleton } from "../../components/ui";
import { toast } from "../../store";
import RouteStudio from "./RouteStudio";
import ConductorsPanel from "./ConductorsPanel";

const TABS = ["Routes", "Buses", "Conductors", "Trips"];

export default function DataManager() {
  const [tab, setTab] = useState("Routes");
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`chip px-4 py-1.5 transition ${tab === t ? "bg-brand-500 text-white" : "bg-white text-slate-500 shadow-soft hover:bg-brand-50"}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === "Routes" && <RoutesTab />}
      {tab === "Buses" && <BusesTab />}
      {tab === "Conductors" && <DriversTab />}
      {tab === "Trips" && <TripsTab />}
    </div>
  );
}

/* ---------------- Routes ---------------- */
const toHHMM = (d) => { const x = new Date(d); return `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`; };
const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toClock = (mins) => `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

function RoutesTab() {
  const [routes, setRoutes] = useState(null);
  const [cities, setCities] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // route id jab edit mode ho
  const [studioId, setStudioId] = useState(null); // 3D Route Studio modal ke liye
  const [origDep, setOrigDep] = useState(""); // edit me pehle ka time — tabhi retime ho jab admin badle
  const EMPTY = { from_city_id: "", to_city_id: "", distance_km: "", base_fare: "", dep_time: "", arr_time: "", stops: [] };
  const [form, setForm] = useState(EMPTY);

  const load = () => api("/admin/routes").then((d) => setRoutes(d.routes));
  useEffect(() => { load(); loadCities().then(setCities); }, []);

  const setStop = (i, patch) => setForm({ ...form, stops: form.stops.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const addStop = () => setForm({ ...form, stops: [...form.stops, { name: "", arr: "", dep: "" }] });
  const rmStop = (i) => setForm({ ...form, stops: form.stops.filter((_, j) => j !== i) });

  const openAdd = () => { setEditing(null); setOrigDep(""); setForm(EMPTY); setOpen(true); };

  const openEdit = async (r) => {
    try {
      const d = await api(`/admin/routes/${r.id}`);
      const firstTrip = d.trips.find((t) => t.status === "SCHEDULED") || d.trips[0];
      const dep_time = firstTrip ? toHHMM(firstTrip.departure_time) : "";
      const arr_time = firstTrip ? toHHMM(firstTrip.arrival_time) : "";
      let stops = [];
      if (r.stops_json && dep_time) {
        const base = toMin(dep_time);
        stops = JSON.parse(r.stops_json).map((s) => ({ name: s.name, arr: toClock(base + s.arrOffset), dep: toClock(base + s.depOffset) }));
      }
      setEditing(r.id);
      setOrigDep(dep_time);
      setForm({
        from_city_id: String(r.from_city_id), to_city_id: String(r.to_city_id),
        distance_km: String(r.distance_km), base_fare: String(r.base_fare),
        dep_time, arr_time, stops,
      });
      setStudioId(null);
      setOpen(true);
    } catch (e) { toast.err(e.message); }
  };

  const save = async () => {
    // Stations ko departure ke relative minutes me bhejo — isse sirf stations badalte hain,
    // baaki trips ke apne-apne times waisa hi rehte hain (retime tabhi jab admin dep_time badle).
    const depMin = form.dep_time ? toMin(form.dep_time) : null;
    const stops = form.stops.filter((s) => s.name).map((s) => {
      if (depMin == null || !s.arr || !s.dep) return { name: s.name, arr: s.arr, dep: s.dep };
      let a = toMin(s.arr) - depMin, d = toMin(s.dep) - depMin;
      if (a <= 0) a += 1440;
      if (d < a) d += 1440;
      return { name: s.name, arrOffset: a, depOffset: d };
    });
    const body = {
      from_city_id: Number(form.from_city_id),
      to_city_id: Number(form.to_city_id),
      distance_km: form.distance_km ? Number(form.distance_km) : undefined,
      base_fare: form.base_fare ? Number(form.base_fare) : undefined,
      dep_time: editing ? (form.dep_time && form.dep_time !== origDep ? form.dep_time : undefined) : (form.dep_time || undefined),
      arr_time: form.arr_time || undefined,
      stops,
    };
    try {
      if (editing) {
        const d = await api(`/admin/routes/${editing}`, { method: "PUT", body });
        toast.ok(`Route updated ✅${d.tripsUpdated ? ` — ${d.tripsUpdated} trips pe apply hua` : ""}`);
      } else {
        const d = await api("/admin/routes", { method: "POST", body });
        toast.ok(`Route added${d.tripsCreated ? ` + ${d.tripsCreated} trips schedule ho gaye` : ""} ✅`);
      }
      setOpen(false); setEditing(null); setForm(EMPTY); load();
    } catch (e) { toast.err(e.message); }
  };

  const del = async (id) => {
    try { await api(`/admin/routes/${id}`, { method: "DELETE" }); toast.ok("Route deleted"); load(); }
    catch (e) { toast.err(e.message); }
  };

  if (!routes) return <Skeleton className="h-72 w-full" />;
  const stopCityOptions = cities.filter((c) => String(c.id) !== String(form.from_city_id) && String(c.id) !== String(form.to_city_id));

  return (
    <div className="card overflow-x-auto p-5">
      <Row title={`Routes (${routes.length})`} onAdd={openAdd} addLabel="+ Add route" />
      <p className="mb-2 text-[11px] text-slate-400">💡 Kisi bhi route pe click karo — <b>3D Route Studio</b> khulega: stations dikhenge aur har station edit bhi kar sakte ho.</p>
      <table className="w-full min-w-[560px]">
        <thead><tr><th className="th">From</th><th className="th">To</th><th className="th">Distance</th><th className="th">Base Fare</th><th className="th">Stations</th><th className="th">Trips</th><th className="th"></th></tr></thead>
        <tbody>
          {routes.map((r) => (
            <tr key={r.id} className="cursor-pointer transition hover:bg-brand-50/60" onClick={() => setStudioId(r.id)}>
              <td className="td font-medium">{r.fromCity.name}</td>
              <td className="td font-medium">{r.toCity.name}</td>
              <td className="td">{r.distance_km} km</td>
              <td className="td">{inr(r.base_fare)}</td>
              <td className="td">{r.stops_json ? `${JSON.parse(r.stops_json).length} 🚏` : "auto"}</td>
              <td className="td">{r._count.trips}</td>
              <td className="td text-right">
                <button className="mr-3 text-xs font-semibold text-brand-600 hover:underline" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>✏️ Edit</button>
                <button className="text-xs font-semibold text-danger-600 hover:underline" onClick={(e) => { e.stopPropagation(); del(r.id); }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ---------- 3D ROUTE STUDIO (click row → 3D stations + edit) ---------- */}
      <Modal open={!!studioId} onClose={() => setStudioId(null)} title="🗺️ 3D Route Studio" maxW="max-w-6xl">
        {studioId && (
          <div className="max-h-[76vh] overflow-y-auto pr-1">
            <RouteStudio rid={studioId} onFullEdit={openEdit} onChanged={load} />
          </div>
        )}
      </Modal>

      {/* ---------- ADD / EDIT MODAL ---------- */}
      <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={editing ? "Edit route — sab kuch badal sakte ho" : "Add route"} maxW="max-w-lg">
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">From city</label>
              <select className="input" value={form.from_city_id} onChange={(e) => setForm({ ...form, from_city_id: e.target.value })}>
                <option value="">Select…</option>{cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div><label className="label">To city</label>
              <select className="input" value={form.to_city_id} onChange={(e) => setForm({ ...form, to_city_id: e.target.value })}>
                <option value="">Select…</option>{cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Distance (km)</label>
              <input className="input" type="number" value={form.distance_km} onChange={(e) => setForm({ ...form, distance_km: e.target.value })} placeholder="auto" /></div>
            <div><label className="label">Price / fare (₹)</label>
              <input className="input" type="number" value={form.base_fare} onChange={(e) => setForm({ ...form, base_fare: e.target.value })} placeholder="auto" /></div>
          </div>

          <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-3">
            <p className="label !mb-2 text-brand-700">⏰ Trip timing (kabhi se kabhi tak)</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Bus chalegi (departure)</label>
                <input className="input" type="time" value={form.dep_time} onChange={(e) => setForm({ ...form, dep_time: e.target.value })} /></div>
              <div><label className="label">Bus pahunchegi (arrival)</label>
                <input className="input" type="time" value={form.arr_time} onChange={(e) => setForm({ ...form, arr_time: e.target.value })} placeholder="auto" /></div>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              {editing ? "Time badloge to aane wale SCHEDULED trips pe naya time apply ho jayega." : "Time doge to agle 4 din ke trips apne aap schedule ho jayenge."} Arrival blank = auto-estimate.
            </p>
          </div>

          <div className="rounded-xl border border-saffron-200 bg-saffron-50/60 p-3">
            <div className="flex items-center justify-between">
              <p className="label !mb-0 text-saffron-700">🚏 Beech ke stations (time ke saath)</p>
              <button type="button" className="chip border border-saffron-300 bg-white text-saffron-700 hover:bg-saffron-100" onClick={addStop}>+ Add station</button>
            </div>
            {form.stops.length === 0 && <p className="mt-2 text-[11px] text-slate-500">Station add nahi karoge to system apne aap route line ke paas wale cities choose karega.{editing ? " (Khali rakha = auto pe wapas)" : ""}</p>}
            {form.stops.length > 0 && !form.dep_time && <p className="mt-2 text-[11px] font-semibold text-danger-600">⚠️ Stations ke liye upar "Bus chalegi" time bhi do</p>}
            {form.stops.map((s, i) => (
              <div key={i} className="mt-2 flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <label className="label">Station {i + 1}</label>
                  <select className="input !py-2 text-xs" value={s.name} onChange={(e) => setStop(i, { name: e.target.value })}>
                    <option value="">Select…</option>
                    {stopCityOptions.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className="w-[92px]"><label className="label">Aayegi</label>
                  <input className="input !px-2 !py-2 text-xs" type="time" value={s.arr} onChange={(e) => setStop(i, { arr: e.target.value })} /></div>
                <div className="w-[92px]"><label className="label">Chalegi</label>
                  <input className="input !px-2 !py-2 text-xs" type="time" value={s.dep} onChange={(e) => setStop(i, { dep: e.target.value })} /></div>
                <button type="button" className="mb-1 text-danger-500 hover:text-danger-700" onClick={() => rmStop(i)}>✕</button>
              </div>
            ))}
          </div>

          <button className="btn-primary w-full" onClick={save} disabled={!form.from_city_id || !form.to_city_id}>
            {editing ? "Save changes" : "Save route"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

/* ---------------- Buses ---------------- */
function BusesTab() {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ bus_number: "", operator_name: "", type: "AC_SEATER" });

  const load = () => api("/admin/buses").then(setData);
  useEffect(() => { load(); }, []);

  const add = async () => {
    try { await api("/admin/buses", { method: "POST", body: form }); toast.ok("Bus added — seat layout generated"); setOpen(false); setForm({ bus_number: "", operator_name: "", type: "AC_SEATER" }); load(); }
    catch (e) { toast.err(e.message); }
  };
  const del = async (id) => {
    try { await api(`/admin/buses/${id}`, { method: "DELETE" }); toast.ok("Bus removed"); load(); }
    catch (e) { toast.err(e.message); }
  };

  if (!data) return <Skeleton className="h-72 w-full" />;
  return (
    <div className="card overflow-x-auto p-5">
      <Row title={`Buses (${data.buses.length})`} onAdd={() => setOpen(true)} addLabel="+ Add bus" />
      <table className="w-full min-w-[620px]">
        <thead><tr><th className="th">Number</th><th className="th">Operator</th><th className="th">Type</th><th className="th">Seats</th><th className="th">Trips</th><th className="th"></th></tr></thead>
        <tbody>
          {data.buses.map((b) => (
            <tr key={b.id} className="hover:bg-mist/60">
              <td className="td font-mono text-xs font-semibold">{b.bus_number}</td>
              <td className="td font-medium">{b.operator_name}</td>
              <td className="td"><Badge tone={b.type.startsWith("AC") ? "green" : "slate"}>{busTypeLabel(b.type)}</Badge></td>
              <td className="td">{b.total_seats}</td>
              <td className="td">{b._count.trips}</td>
              <td className="td text-right"><button className="text-xs font-semibold text-danger-600 hover:underline" onClick={() => del(b.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Modal open={open} onClose={() => setOpen(false)} title="Add bus">
        <div className="space-y-3">
          <div><label className="label">Bus number</label>
            <input className="input" placeholder="GJ-01-XX-0000" value={form.bus_number} onChange={(e) => setForm({ ...form, bus_number: e.target.value })} /></div>
          <div><label className="label">Operator name</label>
            <input className="input" placeholder="e.g. Patel Roadways" value={form.operator_name} onChange={(e) => setForm({ ...form, operator_name: e.target.value })} /></div>
          <div><label className="label">Bus type</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(data.busTypes).map(([k, v]) => <option key={k} value={k}>{v.label} — {v.seats} seats ({v.layout})</option>)}
            </select></div>
          <p className="rounded-lg bg-mist p-2 text-xs text-slate-500">Seat map for this bus is generated automatically from the type.</p>
          <button className="btn-primary w-full" onClick={add} disabled={!form.bus_number || !form.operator_name}>Save bus</button>
        </div>
      </Modal>
    </div>
  );
}

/* ---------------- Conductors ---------------- */
function DriversTab() {
  return <ConductorsPanel />;
}

/* ---------------- Trips ---------------- */
function TripsTab() {
  const [date, setDate] = useState(todayStr());
  const [trips, setTrips] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [editTrip, setEditTrip] = useState(null);
  const [driverId, setDriverId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api(`/admin/trips?date=${date}`).then((d) => setTrips(d.trips));
  useEffect(() => { setTrips(null); load(); }, [date]);
  useEffect(() => {
    api("/admin/drivers").then((d) => setDrivers(d.drivers)).catch(() => {});
  }, []);

  const openEdit = (t) => { setEditTrip(t); setDriverId(String(t.driver?.id ?? t.driver_id ?? "")); };

  const save = async () => {
    if (!driverId || busy) return;
    setBusy(true);
    try {
      await api(`/admin/trips/${editTrip.id}`, { method: "PUT", body: { driverId: Number(driverId) } });
      const d = drivers.find((x) => String(x.id) === String(driverId));
      toast.ok(`✅ Is trip ka conductor ab ${d?.name || "naya"} (${d?.conductor_id || ""}) hai`);
      setEditTrip(null);
      load();
    } catch (e) { toast.err(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="card overflow-x-auto p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-[15px] font-semibold">Trips & schedule</h3>
        <input type="date" className="input w-40 py-1.5 text-xs" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {!trips ? <Skeleton className="h-60 w-full" /> : trips.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No trips on {date}. They appear automatically when passengers search.</p>
      ) : (
        <>
          <p className="mb-2 text-[11px] text-slate-400">💡 ✏️ Edit se kisi bhi trip ka conductor badal sakte ho.</p>
          <table className="w-full min-w-[620px]">
            <thead><tr><th className="th">Route</th><th className="th">Departure</th><th className="th">Bus</th><th className="th">Conductor</th><th className="th"></th></tr></thead>
            <tbody>
              {trips.map((t) => (
                <tr key={t.id} className="hover:bg-mist/60">
                  <td className="td font-medium">{t.route.fromCity.name} → {t.route.toCity.name}</td>
                  <td className="td">{fmtTime(t.departure_time)}</td>
                  <td className="td font-mono text-xs">{t.bus.bus_number}</td>
                  <td className="td">{t.driver?.name ? <>{t.driver.name} <span className="font-mono text-xs font-semibold text-brand-700">({t.driver.conductor_id || "—"})</span></> : "—"}</td>
                  <td className="td text-right">
                    <button className="text-xs font-semibold text-brand-600 hover:underline" onClick={() => openEdit(t)}>✏️ Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <Modal open={!!editTrip} onClose={() => setEditTrip(null)} title="✏️ Conductor badlo">
        {editTrip && (
          <div className="space-y-3">
            <div className="rounded-xl bg-mist p-3">
              <p className="font-display text-[15px] font-bold">{editTrip.route.fromCity.name} → {editTrip.route.toCity.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{fmtTime(editTrip.departure_time)} • {editTrip.bus.bus_number} • abhi: {editTrip.driver?.name || "—"} ({editTrip.driver?.conductor_id || "—"})</p>
            </div>
            <div>
              <label className="label">Naya conductor</label>
              <select className="input" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
                <option value="">Select…</option>
                {drivers.map((d) => <option key={d.id} value={d.id}>{d.name} — ({d.conductor_id})</option>)}
              </select>
            </div>
            <button className="btn-primary w-full" disabled={!driverId || busy} onClick={save}>{busy ? "Saving…" : "Save conductor"}</button>
          </div>
        )}
      </Modal>
    </div>
  );
}

const Row = ({ title, onAdd, addLabel }) => (
  <div className="mb-4 flex items-center justify-between">
    <h3 className="font-display text-[15px] font-semibold">{title}</h3>
    <button className="btn-brand py-1.5 text-xs" onClick={onAdd}>{addLabel}</button>
  </div>
);
