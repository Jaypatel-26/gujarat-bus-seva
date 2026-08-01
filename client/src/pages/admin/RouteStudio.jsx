import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Flag, BusFront } from "lucide-react";
import { api, loadCities, busTypeLabel } from "../../api";
import { fmtTime, fmtDate, statusLabel, statusTone, inr } from "../../lib/format";
import { Badge, Skeleton } from "../../components/ui";
import { toast } from "../../store";

const KIND = {
  BOARDING: { color: "#1E8E5A", label: "Boarding" },
  STOP: { color: "#0F4C81", label: "Halt" },
  DROP: { color: "#F4A100", label: "Drop" },
};

// Wahi 3D tilt maths jo passenger ke Route Vision me hai
const COS = Math.cos((38 * Math.PI) / 180);
const sx = (x) => x / 10;
const sy = (y) => (1 - (1 - y / 300) * COS) * 100;

const toHHMM = (d) => { const x = new Date(d); return `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`; };
const toMin = (t) => { const [h, m] = t.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const wrapMin = (m) => ((m % 1440) + 1440) % 1440;
const toClock = (mins) => { const w = Math.round(wrapMin(mins)); return `${String(Math.floor(w / 60)).padStart(2, "0")}:${String(w % 60).padStart(2, "0")}`; };

function Billboard({ p, side, idx, onClick, selected, depBaseMin, hasRef }) {
  const k = KIND[p.s.kind];
  const isEnd = p.s.kind !== "STOP";
  const anchorX = p.s.kind === "BOARDING" ? "translateX(-12%)" : p.s.kind === "DROP" ? "translateX(-88%)" : "translateX(-50%)";
  const lift = side === "above" ? "translateY(-100%)" : "";

  const timeLine = p.s.kind === "BOARDING"
    ? (hasRef ? `${toClock(depBaseMin)} se chalegi` : "start point")
    : p.s.kind === "DROP"
      ? (hasRef ? `${toClock(depBaseMin + (p.s.arrOff ?? 0))} pahunchegi` : "final point")
      : hasRef
        ? `${toClock(depBaseMin + p.s.arrOff)} – ${toClock(depBaseMin + p.s.depOff)}`
        : `+${toClock(p.s.arrOff)} – +${toClock(p.s.depOff)}`;

  const card = (
    <motion.div
      initial={{ opacity: 0, y: side === "above" ? 12 : -12, scale: 0.75 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ scale: 1.14, rotateX: 10, y: side === "above" ? -6 : 6, boxShadow: "0 22px 44px -10px rgba(15,76,129,0.45)" }}
      transition={{ delay: 0.35 + idx * 0.13, type: "spring", stiffness: 210, damping: 17 }}
      onClick={onClick}
      className={`flex w-[150px] cursor-pointer flex-col justify-center rounded-xl border-2 bg-white/95 px-2.5 py-2 text-center shadow-lift backdrop-blur transition ${selected ? "ring-4 ring-saffron-300" : ""}`}
      style={{ borderColor: k.color, transformStyle: "preserve-3d" }}
    >
      <p className="truncate text-[13.5px] font-bold text-slate-800">
        {p.s.name}{p.s.kind === "STOP" && <span className="ml-1 text-[10px]">✏️</span>}
      </p>
      <p className="text-[11px] font-semibold leading-snug" style={{ color: k.color }}>{timeLine}</p>
        {p.s.kind === "STOP" && p.s.depOff - p.s.arrOff >= 10 && <p className="text-[9.5px] font-semibold text-amber-600">🍽️ break {p.s.depOff - p.s.arrOff}m</p>}
      {p.s.km > 0 && <p className="text-[9px] font-semibold text-slate-400">{p.s.km} km from start</p>}
      {!isEnd && <p className="text-[9px] font-bold text-brand-400">tap to edit</p>}
    </motion.div>
  );

  const pole = <span className="pointer-events-none block w-0.5 shrink-0" style={{ background: `${k.color}66`, height: 22 }} />;
  const pin = (
    <motion.span
      initial={{ scale: 0 }} animate={{ scale: 1 }}
      transition={{ delay: 0.25 + idx * 0.13, type: "spring", stiffness: 260, damping: 14 }}
      className="relative block"
    >
      <span className="absolute inset-0 animate-ping rounded-full opacity-40" style={{ background: k.color }} />
      <span className="relative block rounded-full border-[3px] border-white shadow-card" style={{ background: k.color, width: isEnd ? 16 : 12, height: isEnd ? 16 : 12 }} />
    </motion.span>
  );

  return (
    <div
      className="absolute z-[5] flex flex-col items-center hover:z-30"
      style={{ left: `${sx(p.x)}%`, top: `${sy(p.y)}%`, transform: `${anchorX} ${lift}`, perspective: "500px" }}
    >
      {side === "above" ? <>{card}{pole}{pin}</> : <>{pin}{pole}{card}</>}
    </div>
  );
}

export default function RouteStudio({ rid, onFullEdit, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [cities, setCities] = useState([]);
  const [mid, setMid] = useState([]); // beech ke stations (editable): { name, arrOff, depOff }
  const [refTrip, setRefTrip] = useState(null);
  const [totalMin, setTotalMin] = useState(0);
  const [sel, setSel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const loadAll = async () => {
    setErr("");
    try {
      const d = await api(`/admin/routes/${rid}`);
      setDetail(d);
      const ref = d.trips.find((t) => t.status === "SCHEDULED") || d.trips[0];
      if (ref) {
        const v = await api(`/trips/${ref.id}/route`);
        setRefTrip(v.trip);
        setTotalMin(Math.max(20, Math.round((new Date(v.trip.arrival_time) - new Date(v.trip.departure_time)) / 60000)));
        setMid(
          v.stops.filter((s) => s.kind === "STOP").map((s) => ({
            name: s.name,
            arrOff: Math.round((new Date(s.arr) - new Date(v.trip.departure_time)) / 60000),
            depOff: Math.round((new Date(s.dep) - new Date(v.trip.departure_time)) / 60000),
          }))
        );
      } else {
        setRefTrip(null);
        const rows = JSON.parse(d.route.stops_json || "[]");
        setMid(rows.map((s) => ({ name: s.name, arrOff: Number(s.arrOffset) || 0, depOff: Number(s.depOffset) || 0 })));
        setTotalMin(rows.length ? Math.round(Math.max(...rows.map((s) => Number(s.depOffset) || 0)) * 1.25) : Math.round(d.route.distance_km * 1.2));
      }
      setSel(null);
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { loadAll(); loadCities().then(setCities); }, [rid]);

  const depBaseMin = refTrip ? toMin(toHHMM(refTrip.departure_time)) : 0;
  const kmTotal = detail?.route?.distance_km || 1;
  const autoMode = detail?.route && !detail.route.stops_json;

  // Ribbon geometry — mid stops edit hote hi live move hote hain
  const geo = useMemo(() => {
    if (!detail) return null;
    const X0 = 80, X1 = 920;
    const stopsAll = [
      { kind: "BOARDING", name: detail.route.fromCity.name, km: 0 },
      ...mid.map((s) => ({ ...s, kind: "STOP", km: Math.max(1, Math.round(kmTotal * Math.min(0.95, (s.arrOff || 1) / Math.max(1, totalMin)))) })),
      { kind: "DROP", name: detail.route.toCity.name, km: Math.round(kmTotal), arrOff: totalMin },
    ];
    const pts = stopsAll.map((s, i) => {
      const x = X0 + (Math.min(s.km, kmTotal) / kmTotal) * (X1 - X0);
      const y = 170 + (i === 0 || i === stopsAll.length - 1 ? 0 : Math.sin(i * 1.9) * 30);
      return { x, y, s };
    });
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const mx = (pts[i - 1].x + pts[i].x) / 2, my = (pts[i - 1].y + pts[i].y) / 2;
      path += ` Q ${pts[i - 1].x} ${pts[i - 1].y}, ${mx} ${my}`;
    }
    path += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
    return { pts, path };
  }, [detail, mid, kmTotal, totalMin]);

  const setStop = (i, patch) => setMid((m) => m.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const setArrClock = (i, v) => { if (!v) return; let off = toMin(v) - depBaseMin; if (off <= 0) off += 1440; setStop(i, { arrOff: off, depOff: Math.max(off, mid[i].depOff) }); };
  const setDepClock = (i, v) => { if (!v) return; let off = toMin(v) - depBaseMin; while (off < mid[i].arrOff) off += 1440; setStop(i, { depOff: off }); };
  const addStop = () => {
    const last = mid[mid.length - 1];
    const arrOff = last ? last.depOff + 30 : Math.max(30, Math.round(totalMin * 0.4));
    setMid([...mid, { name: "", arrOff, depOff: arrOff + 5 }]);
    setSel(mid.length);
  };
  const rmStop = (i) => { setMid(mid.filter((_, j) => j !== i)); setSel(null); };

  const save = async () => {
    if (mid.some((s) => !s.name)) { toast.err("Har station ka name select karo (ya hata do)"); return; }
    setSaving(true);
    try {
      await api(`/admin/routes/${rid}`, { method: "PUT", body: { stops: mid.map((s) => ({ name: s.name, arrOffset: s.arrOff, depOffset: s.depOff })) } });
      toast.ok("Stations save ho gaye ✅ — Route Vision me yehi dikhenge");
      await loadAll();
      onChanged?.();
    } catch (e) { toast.err(e.message); }
    finally { setSaving(false); }
  };

  if (err) return <div className="p-6 text-center text-sm font-medium text-danger-600">{err}</div>;
  if (!detail || !geo) return <div className="space-y-3 p-1"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-64 w-full" /><Skeleton className="h-32 w-full" /></div>;

  const { route, trips, stats } = detail;
  const stopNames = new Set(mid.map((s) => s.name));
  const cityOptions = cities.filter((c) => c.id !== route.from_city_id && c.id !== route.to_city_id && !stopNames.has(c.name));

  return (
    <div className="space-y-4">
      {/* stats */}
      <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
        <div className="rounded-xl bg-mist p-3"><p className="label !mb-1">Distance</p><p className="font-bold">{route.distance_km} km</p></div>
        <div className="rounded-xl bg-mist p-3"><p className="label !mb-1">Base fare</p><p className="font-bold">{inr(route.base_fare)}</p></div>
        <div className="rounded-xl bg-mist p-3"><p className="label !mb-1">Total trips</p><p className="font-bold">{stats.totalTrips}</p></div>
        <div className="rounded-xl bg-mist p-3"><p className="label !mb-1">Bookings</p><p className="font-bold">{stats.totalBookings}</p></div>
      </div>

      {/* 3D studio */}
      <div className="card overflow-hidden p-0">
        <div className="border-b border-slate-100 bg-gradient-to-r from-brand-600 to-brand-800 px-5 py-3">
          <p className="text-sm font-semibold text-white">🗺️ 3D Route Studio — station pe click karo, ✏️ edit karo</p>
          <p className="text-xs text-brand-100">
            {autoMode
              ? "🤖 Ye stations abhi AUTO hain — Save karne par custom/fixed ho jayenge"
              : "Ye custom stations passenger ke Route Vision me dikhte hain"}
            {refTrip ? ` • Time preview: ${fmtDate(refTrip.date)} ki ${toClock(depBaseMin)} wali trip ke hisaab se` : " • Trip nahi hai — time “+min after departure” me hai"}
          </p>
        </div>

        <div className="overflow-x-auto bg-gradient-to-b from-sky-100 via-[#eaf4fd] to-white">
          <div className="relative mx-auto h-[430px] min-w-[780px] max-w-4xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}
              className="absolute right-[8%] top-[5%] h-16 w-16 rounded-full bg-gradient-to-br from-amber-200 to-saffron-400 opacity-80 blur-[2px]"
              style={{ boxShadow: "0 0 60px 24px rgba(244,161,0,0.35)" }}
            />
            {[{ top: "9%", size: 90, dur: 34, delay: 0 }, { top: "21%", size: 60, dur: 46, delay: 9 }].map((c, i) => (
              <motion.div key={i}
                initial={{ x: "-15vw", opacity: 0 }}
                animate={{ x: "62vw", opacity: [0, 0.85, 0.85, 0] }}
                transition={{ duration: c.dur, delay: c.delay, repeat: Infinity, ease: "linear" }}
                className="absolute rounded-full bg-white/80 blur-md"
                style={{ top: c.top, width: c.size, height: c.size * 0.42 }}
              />
            ))}

            <div className="absolute inset-x-[2%] bottom-0 top-[14%]">
              <div className="absolute inset-0 rounded-3xl"
                style={{
                  transform: "rotateX(38deg)", transformOrigin: "50% 100%",
                  backgroundImage: "linear-gradient(rgba(15,76,129,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(15,76,129,0.09) 1px, transparent 1px), radial-gradient(ellipse at 50% 0%, rgba(30,142,90,0.10), transparent 70%)",
                  backgroundSize: "46px 46px, 46px 46px, 100% 100%",
                  boxShadow: "inset 0 -40px 80px rgba(15,76,129,0.10), inset 0 20px 60px rgba(255,255,255,0.6)",
                }}
              />
              <svg viewBox="0 0 1000 300" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" style={{ transform: "rotateX(38deg)", transformOrigin: "50% 100%" }}>
                <defs>
                  <linearGradient id="rsLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#1E8E5A" /><stop offset="55%" stopColor="#0F4C81" /><stop offset="100%" stopColor="#F4A100" />
                  </linearGradient>
                  <filter id="rsBlur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" /></filter>
                </defs>
                <path d={geo.path} fill="none" stroke="rgba(15,76,129,0.22)" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" filter="url(#rsBlur)" transform="translate(5,16)" />
                <motion.path key={geo.path} d={geo.path} fill="none" stroke="#ffffff" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: "easeInOut" }} />
                <motion.path d={geo.path} fill="none" stroke="url(#rsLine)" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: "easeInOut", delay: 0.1 }} />
                <path d={geo.path} fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 20" className="dashmove" opacity="0.9" />
              </svg>

              {geo.pts.map((p, i) => {
                const isEnd = i === 0 || i === geo.pts.length - 1;
                const side = isEnd ? "above" : i % 2 === 0 ? "below" : "above";
                const midIdx = i - 1;
                return (
                  <Billboard
                    key={`${p.s.kind}-${p.s.name}-${i}`}
                    p={p} side={side} idx={i} depBaseMin={depBaseMin} hasRef={!!refTrip}
                    selected={midIdx >= 0 && sel === midIdx}
                    onClick={() => {
                      if (isEnd) { toast.ok(`${p.s.kind === "BOARDING" ? "Boarding" : "Drop"} city route ka hissa hai — badalne ke liye “Poora edit” use karo`); return; }
                      setSel(sel === midIdx ? null : midIdx);
                    }}
                  />
                );
              })}

              {/* preview bus — pura route ghoom ke end pe rukti hai */}
              <motion.div
                className="absolute z-10"
                initial={{ left: `${sx(80)}%`, top: `${sy(170)}%` }}
                animate={{ left: `${sx(920)}%`, top: `${sy(170)}%` }}
                transition={{ duration: 2.8, ease: "easeInOut", delay: 0.5 }}
                style={{ transform: "translate(-50%, -92%)" }}
              >
                <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }} className="text-center">
                  <span className="block text-[34px] leading-none drop-shadow-[0_8px_8px_rgba(15,76,129,0.35)]">🚌</span>
                </motion.div>
                <span className="mx-auto block h-2 w-8 rounded-[50%] bg-brand-900/20 blur-[3px]" />
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- editor panel ---- */}
      <div className="rounded-xl border border-saffron-200 bg-saffron-50/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="label !mb-0 text-saffron-700">✏️ Station editor (beech ke stations) — {mid.length} stations</p>
          <div className="flex gap-2">
            <button className="chip border border-saffron-300 bg-white text-saffron-700 hover:bg-saffron-100" onClick={addStop}>+ Naya station</button>
            <button className="btn-brand py-1.5 text-xs" onClick={save} disabled={saving}>{saving ? "Saving…" : "💾 Stations save karo"}</button>
          </div>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">Time har trip ki <b>nikalne ke time ke relative</b> save hota hai — ek baar save karne se sab trips pe apply ho jayega.</p>

        {sel == null ? (
          mid.length === 0
            ? <p className="mt-3 rounded-lg bg-white/80 px-3 py-3 text-center text-xs text-slate-500">Koi beech ka station nahi — “+ Naya station” se add karo (ya Route Vision auto bana dega).</p>
            : <p className="mt-3 rounded-lg bg-white/80 px-3 py-3 text-center text-xs text-slate-500">👆 Upar 3D road me kisi station pe <b>click</b> karo — uska edit panel yaha khulega.</p>
        ) : mid[sel] && (
          <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-white p-3 shadow-soft">
            <div className="min-w-[200px] flex-1">
              <label className="label">Station {sel + 1} ka naam</label>
              <select className="input !py-2 text-sm" value={mid[sel].name} onChange={(e) => setStop(sel, { name: e.target.value })}>
                <option value="">Select…</option>
                {mid[sel].name && !cities.some((c) => c.name === mid[sel].name) && <option value={mid[sel].name}>{mid[sel].name}</option>}
                {cityOptions.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            {refTrip ? (
              <>
                <div className="w-[110px]"><label className="label">Aayegi</label>
                  <input className="input !px-2 !py-2 text-sm" type="time" value={toClock(depBaseMin + mid[sel].arrOff)} onChange={(e) => setArrClock(sel, e.target.value)} /></div>
                <div className="w-[110px]"><label className="label">Chalegi</label>
                  <input className="input !px-2 !py-2 text-sm" type="time" value={toClock(depBaseMin + mid[sel].depOff)} onChange={(e) => setDepClock(sel, e.target.value)} /></div>
              </>
            ) : (
              <>
                <div className="w-[130px]"><label className="label">Aayegi (+min)</label>
                  <input className="input !px-2 !py-2 text-sm" type="number" min={1} value={mid[sel].arrOff} onChange={(e) => setStop(sel, { arrOff: Math.max(1, Number(e.target.value) || 1) })} /></div>
                <div className="w-[130px]"><label className="label">Chalegi (+min)</label>
                  <input className="input !px-2 !py-2 text-sm" type="number" min={1} value={mid[sel].depOff} onChange={(e) => setStop(sel, { depOff: Math.max(1, Number(e.target.value) || 1) })} /></div>
              </>
            )}
            <div className="rounded-lg bg-mist px-3 py-2 text-xs text-slate-500">
              Halt <b>{Math.max(0, mid[sel].depOff - mid[sel].arrOff)}m</b><br />≈ {Math.round(kmTotal * Math.min(0.95, (mid[sel].arrOff || 1) / Math.max(1, totalMin)))} km
            </div>
            <button className="btn-ghost !py-2 text-xs text-danger-600" onClick={() => rmStop(sel)}>🗑 Hata do</button>
            <button className="btn-ghost !py-2 text-xs" onClick={() => setSel(null)}>Done</button>
          </div>
        )}
      </div>

      {/* ---- upcoming trips ---- */}
      <div>
        <p className="label">🚌 Upcoming trips ({trips.filter((t) => t.departure_time >= new Date().toISOString()).length})</p>
        {trips.length === 0 ? (
          <p className="rounded-lg bg-mist px-3 py-3 text-xs text-slate-500">Is route pe koi trip nahi — “Poora edit” se time do, ya Trips tab se schedule karo.</p>
        ) : (
          <div className="max-h-56 overflow-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[540px] text-sm">
              <thead className="sticky top-0"><tr className="bg-mist/90 text-left"><th className="th">Date</th><th className="th">Time</th><th className="th">Bus</th><th className="th">Conductor</th><th className="th">Booked</th><th className="th">Status</th></tr></thead>
              <tbody>
                {trips.map((t) => (
                  <tr key={t.id} className="border-t border-slate-50">
                    <td className="td">{fmtDate(t.date)}</td>
                    <td className="td font-medium">{fmtTime(t.departure_time)} → {fmtTime(t.arrival_time)}</td>
                    <td className="td text-xs">{t.bus.operator_name}<br /><span className="text-slate-400">{t.bus.bus_number} • {busTypeLabel(t.bus.type)}</span></td>
                    <td className="td text-xs">{t.driver.name}<br /><span className="font-mono text-slate-400">{t.driver.conductor_id || "—"}</span></td>
                    <td className="td">{t._count.bookings}</td>
                    <td className="td"><Badge tone={statusTone(t.status)}>{statusLabel(t.status)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <button className="btn-primary w-full" onClick={() => onFullEdit(route)}>✏️ Poora route edit karo (cities, km, fare, bus timing)</button>

      <p className="rounded-xl bg-brand-50 px-4 py-3 text-center text-xs text-brand-700">
        ℹ️ Save karne ke baad passenger app ke <b>3D Route Vision</b> me yehi stations aur time dikhenge.
      </p>

      {/* hidden icons import use */}
      <span className="hidden"><MapPin size={1} /><Flag size={1} /><BusFront size={1} /></span>
    </div>
  );
}
