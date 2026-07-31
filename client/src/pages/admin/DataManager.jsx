import { useEffect, useState } from "react";
import { api, loadCities, busTypeLabel } from "../../api";
import { fmtTime, statusLabel, statusTone, todayStr, inr } from "../../lib/format";
import { Badge, Modal, Skeleton } from "../../components/ui";
import { toast } from "../../store";

const TABS = ["Routes", "Buses", "Drivers", "Trips"];

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
      {tab === "Drivers" && <DriversTab />}
      {tab === "Trips" && <TripsTab />}
    </div>
  );
}

/* ---------------- Routes ---------------- */
function RoutesTab() {
  const [routes, setRoutes] = useState(null);
  const [cities, setCities] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ from_city_id: "", to_city_id: "", distance_km: "" });

  const load = () => api("/admin/routes").then((d) => setRoutes(d.routes));
  useEffect(() => { load(); loadCities().then(setCities); }, []);

  const add = async () => {
    try {
      await api("/admin/routes", { method: "POST", body: { ...form, from_city_id: Number(form.from_city_id), to_city_id: Number(form.to_city_id), distance_km: form.distance_km ? Number(form.distance_km) : undefined } });
      toast.ok("Route added"); setOpen(false); setForm({ from_city_id: "", to_city_id: "", distance_km: "" }); load();
    } catch (e) { toast.err(e.message); }
  };
  const del = async (id) => {
    try { await api(`/admin/routes/${id}`, { method: "DELETE" }); toast.ok("Route deleted"); load(); }
    catch (e) { toast.err(e.message); }
  };

  if (!routes) return <Skeleton className="h-72 w-full" />;
  return (
    <div className="card overflow-x-auto p-5">
      <Row title={`Routes (${routes.length})`} onAdd={() => setOpen(true)} addLabel="+ Add route" />
      <table className="w-full min-w-[560px]">
        <thead><tr><th className="th">From</th><th className="th">To</th><th className="th">Distance</th><th className="th">Base Fare</th><th className="th">Trips</th><th className="th"></th></tr></thead>
        <tbody>
          {routes.map((r) => (
            <tr key={r.id} className="hover:bg-mist/60">
              <td className="td font-medium">{r.fromCity.name}</td>
              <td className="td font-medium">{r.toCity.name}</td>
              <td className="td">{r.distance_km} km</td>
              <td className="td">{inr(r.base_fare)}</td>
              <td className="td">{r._count.trips}</td>
              <td className="td text-right"><button className="text-xs font-semibold text-danger-600 hover:underline" onClick={() => del(r.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Modal open={open} onClose={() => setOpen(false)} title="Add route">
        <div className="space-y-3">
          <div><label className="label">From city</label>
            <select className="input" value={form.from_city_id} onChange={(e) => setForm({ ...form, from_city_id: e.target.value })}>
              <option value="">Select…</option>{cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label className="label">To city</label>
            <select className="input" value={form.to_city_id} onChange={(e) => setForm({ ...form, to_city_id: e.target.value })}>
              <option value="">Select…</option>{cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label className="label">Distance (km) — leave blank to auto-estimate</label>
            <input className="input" type="number" value={form.distance_km} onChange={(e) => setForm({ ...form, distance_km: e.target.value })} placeholder="auto" /></div>
          <button className="btn-primary w-full" onClick={add} disabled={!form.from_city_id || !form.to_city_id}>Save route</button>
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

/* ---------------- Drivers ---------------- */
function DriversTab() {
  const [drivers, setDrivers] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", mobile: "" });

  const load = () => api("/admin/drivers").then((d) => setDrivers(d.drivers));
  useEffect(() => { load(); }, []);

  const add = async () => {
    try { await api("/admin/drivers", { method: "POST", body: form }); toast.ok("Driver added — they log in with OTP"); setOpen(false); setForm({ name: "", mobile: "" }); load(); }
    catch (e) { toast.err(e.message); }
  };
  const del = async (id) => {
    try { await api(`/admin/drivers/${id}`, { method: "DELETE" }); toast.ok("Driver removed"); load(); }
    catch (e) { toast.err(e.message); }
  };

  if (!drivers) return <Skeleton className="h-60 w-full" />;
  return (
    <div className="card overflow-x-auto p-5">
      <Row title={`Drivers (${drivers.length})`} onAdd={() => setOpen(true)} addLabel="+ Add driver" />
      <table className="w-full min-w-[480px]">
        <thead><tr><th className="th">Name</th><th className="th">Mobile</th><th className="th">Trips assigned</th><th className="th"></th></tr></thead>
        <tbody>
          {drivers.map((d) => (
            <tr key={d.id} className="hover:bg-mist/60">
              <td className="td font-medium">{d.name}</td>
              <td className="td font-mono text-xs">{d.mobile}</td>
              <td className="td">{d.trips}</td>
              <td className="td text-right"><button className="text-xs font-semibold text-danger-600 hover:underline" onClick={() => del(d.id)}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Modal open={open} onClose={() => setOpen(false)} title="Add driver">
        <div className="space-y-3">
          <div><label className="label">Full name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Mobile (login via OTP)</label><input className="input" maxLength={10} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "") })} /></div>
          <button className="btn-primary w-full" onClick={add} disabled={!form.name || form.mobile.length !== 10}>Save driver</button>
        </div>
      </Modal>
    </div>
  );
}

/* ---------------- Trips ---------------- */
function TripsTab() {
  const [date, setDate] = useState(todayStr());
  const [trips, setTrips] = useState(null);
  const [open, setOpen] = useState(false);
  const [aux, setAux] = useState({ routes: [], buses: [] });
  const [form, setForm] = useState({ route_id: "", bus_id: "", date: todayStr(), time: "18:00" });

  const load = () => api(`/admin/trips?date=${date}`).then((d) => setTrips(d.trips));
  useEffect(() => { setTrips(null); load(); }, [date]);
  useEffect(() => {
    api("/admin/routes").then((d) => setAux((a) => ({ ...a, routes: d.routes })));
    api("/admin/buses").then((d) => setAux((a) => ({ ...a, buses: d.buses })));
  }, []);

  const setStatus = async (id, status) => {
    try { await api(`/admin/trips/${id}`, { method: "PUT", body: { status } }); toast.ok(`Trip → ${statusLabel(status)}`); load(); }
    catch (e) { toast.err(e.message); }
  };
  const add = async () => {
    try { await api("/admin/trips", { method: "POST", body: { ...form, route_id: Number(form.route_id), bus_id: Number(form.bus_id) } }); toast.ok("Trip scheduled"); setOpen(false); load(); }
    catch (e) { toast.err(e.message); }
  };

  return (
    <div className="card overflow-x-auto p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-[15px] font-semibold">Trips & schedule</h3>
        <div className="flex items-center gap-2">
          <input type="date" className="input w-40 py-1.5 text-xs" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn-brand py-1.5 text-xs" onClick={() => setOpen(true)}>+ Schedule trip</button>
        </div>
      </div>
      {!trips ? <Skeleton className="h-60 w-full" /> : trips.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No trips on {date}. They appear automatically when passengers search.</p>
      ) : (
        <table className="w-full min-w-[700px]">
          <thead><tr><th className="th">Route</th><th className="th">Departure</th><th className="th">Bus</th><th className="th">Driver</th><th className="th">Bookings</th><th className="th">Status</th></tr></thead>
          <tbody>
            {trips.map((t) => (
              <tr key={t.id} className="hover:bg-mist/60">
                <td className="td font-medium">{t.route.fromCity.name} → {t.route.toCity.name}</td>
                <td className="td">{fmtTime(t.departure_time)}</td>
                <td className="td font-mono text-xs">{t.bus.bus_number}</td>
                <td className="td">{t.driver?.name || "—"}</td>
                <td className="td">{t._count.bookings}</td>
                <td className="td">
                  <select value={t.status} onChange={(e) => setStatus(t.id, e.target.value)}
                    className={`chip cursor-pointer border-0 outline-none ${statusTone(t.status) === "green" ? "bg-leaf-50 text-leaf-700" : statusTone(t.status) === "red" ? "bg-danger-50 text-danger-600" : statusTone(t.status) === "blue" ? "bg-brand-50 text-brand-600" : "bg-slate-100 text-slate-600"}`}>
                    {["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Schedule a trip">
        <div className="space-y-3">
          <div><label className="label">Route</label>
            <select className="input" value={form.route_id} onChange={(e) => setForm({ ...form, route_id: e.target.value })}>
              <option value="">Select…</option>
              {aux.routes.map((r) => <option key={r.id} value={r.id}>{r.fromCity.name} → {r.toCity.name} ({r.distance_km} km)</option>)}
            </select></div>
          <div><label className="label">Bus</label>
            <select className="input" value={form.bus_id} onChange={(e) => setForm({ ...form, bus_id: e.target.value })}>
              <option value="">Select…</option>
              {aux.buses.map((b) => <option key={b.id} value={b.id}>{b.bus_number} • {b.operator_name}</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Date</label><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><label className="label">Departure time</label><input type="time" className="input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
          </div>
          <button className="btn-primary w-full" onClick={add} disabled={!form.route_id || !form.bus_id}>Schedule</button>
        </div>
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
