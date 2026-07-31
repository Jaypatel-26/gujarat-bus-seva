import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Flag, UtensilsCrossed, BusFront } from "lucide-react";
import { api, busTypeLabel } from "../api";
import { Page, Skeleton, Badge } from "../components/ui";
import { fmtTime, fmtDate, minsToText, inr } from "../lib/format";

const KIND = {
  BOARDING: { color: "#1E8E5A", label: "Boarding", icon: "🟢" },
  STOP: { color: "#0F4C81", label: "Halt", icon: "🔵" },
  DROP: { color: "#F4A100", label: "Drop", icon: "🟠" },
};

export default function RouteVision() {
  const { id, tripId } = useParams();
  const tid = id || tripId;
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setData(null); setErr("");
    api(`/trips/${tid}/route`).then(setData).catch((e) => setErr(e.message));
  }, [tid]);

  // Geometry for the 3D ribbon
  const geo = useMemo(() => {
    if (!data) return null;
    const W = 1000, H = 300, X0 = 90, X1 = 910;
    const total = data.route.distance_km || 1;
    const pts = data.stops.map((s, i) => {
      const x = X0 + (s.km / total) * (X1 - X0);
      const y = 150 + (i === 0 || i === data.stops.length - 1 ? 0 : Math.sin(i * 1.9) * 44);
      return { x, y, s };
    });
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const mx = (pts[i - 1].x + pts[i].x) / 2, my = (pts[i - 1].y + pts[i].y) / 2;
      path += ` Q ${pts[i - 1].x} ${pts[i - 1].y}, ${mx} ${my}`;
    }
    path += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
    return { W, H, pts, path };
  }, [data]);

  // Expected position right now (schedule-based, no GPS)
  const nowInfo = useMemo(() => {
    if (!data) return null;
    const dep = new Date(data.trip.departure_time).getTime();
    const arr = new Date(data.trip.arrival_time).getTime();
    const now = Date.now();
    if (now < dep || now > arr) return null;
    const f = Math.min(1, Math.max(0, (now - dep) / (arr - dep)));
    const kmNow = f * data.route.distance_km;
    // next stop we haven't reached yet
    const next = data.stops.find((s) => new Date(s.arr || s.dep).getTime() > now);
    const prev = [...data.stops].reverse().find((s) => new Date(s.dep || s.arr).getTime() <= now);
    let pos = null;
    if (geo) {
      for (let i = 0; i < geo.pts.length - 1; i++) {
        const a = geo.pts[i], b = geo.pts[i + 1];
        if (kmNow >= a.s.km && kmNow <= b.s.km) {
          const tt = (kmNow - a.s.km) / Math.max(1, b.s.km - a.s.km);
          pos = { x: a.x + (b.x - a.x) * tt, y: a.y + (b.y - a.y) * tt };
          break;
        }
      }
    }
    return { f, kmNow: Math.round(kmNow), next, prev, pos };
  }, [data, geo]);

  if (err) return <Page className="mx-auto max-w-3xl px-4 py-10"><div className="card p-6 text-center text-danger-600 font-medium">{err}</div></Page>;

  if (!data || !geo) {
    return <Page className="mx-auto max-w-5xl px-4 py-10"><Skeleton className="h-64 w-full" /><Skeleton className="mt-4 h-40 w-full" /></Page>;
  }

  const { trip, bus, route, stops } = data;

  return (
    <Page className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold md:text-2xl">
            {route.from.name} <span className="text-saffron-600">→</span> {route.to.name}
            <span className="ml-2 align-middle text-sm font-semibold text-brand-500">3D Route Vision</span>
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {fmtDate(trip.date)} • {fmtTime(trip.departure_time)} – {fmtTime(trip.arrival_time)} • {minsToText(route.duration_min)} • {Math.round(route.distance_km)} km
          </p>
          <p className="mt-0.5 text-xs text-slate-400">{bus.operator_name} • {bus.bus_number} • {busTypeLabel(bus.type)} • {stops.length} stations</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="blue">{inr(trip.fare)}</Badge>
          <Link to="/bookings" className="btn-ghost">My Bookings</Link>
        </div>
      </div>

      {/* 3D Route Ribbon */}
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="card overflow-hidden p-0">
        <div className="border-b border-slate-100 bg-gradient-to-r from-brand-600 to-brand-800 px-5 py-3">
          <p className="text-sm font-semibold text-white">🗺️ Pura route — station wise, time ke saath</p>
          <p className="text-xs text-brand-100">Bus kaun se time kis station par pahunchegi — sab neeche dikhaya hai</p>
        </div>
        <div className="overflow-x-auto bg-gradient-to-b from-sky-50 via-mist to-white">
          <div className="mx-auto min-w-[720px] max-w-4xl px-2 py-6" style={{ perspective: "1100px" }}>
            <div
              style={{
                transform: "rotateX(52deg)",
                transformStyle: "preserve-3d",
                backgroundImage:
                  "linear-gradient(rgba(15,76,129,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15,76,129,0.06) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
                borderRadius: "1.25rem",
                boxShadow: "inset 0 0 60px rgba(15,76,129,0.08)",
              }}
            >
              <svg viewBox={`0 0 ${geo.W} ${geo.H}`} className="block w-full">
                <defs>
                  <linearGradient id="routeLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#1E8E5A" />
                    <stop offset="55%" stopColor="#0F4C81" />
                    <stop offset="100%" stopColor="#F4A100" />
                  </linearGradient>
                  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>

                {/* under-path shadow (fake 3D depth) */}
                <path d={geo.path} fill="none" stroke="rgba(15,76,129,0.15)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" transform="translate(6,14)" />
                {/* animated main path */}
                <motion.path
                  d={geo.path} fill="none" stroke="url(#routeLine)" strokeWidth="6"
                  strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease: "easeInOut" }}
                />

                {/* station pins */}
                {geo.pts.map((p, i) => {
                  const k = KIND[p.s.kind];
                  return (
                    <motion.g key={p.s.seq} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 + i * 0.18 }}>
                      <line x1={p.x} y1={p.y} x2={p.x} y2={p.y - 46} stroke={k.color} strokeWidth="2" strokeDasharray="3 4" />
                      <circle cx={p.x} cy={p.y} r={p.s.kind === "STOP" ? 8 : 11} fill={k.color} filter="url(#glow)" stroke="#fff" strokeWidth="3" />
                      {/* floating label card */}
                      <g transform={`translate(${p.x}, ${p.y - 78})`}>
                        <rect x="-64" y="0" width="128" height={p.s.kind === "STOP" ? 44 : 32} rx="9" fill="#fff" stroke={k.color} strokeWidth="1.4" />
                        <text x="0" y="17" textAnchor="middle" fontSize="13.5" fontWeight="700" fill="#1e293b">{p.s.name}</text>
                        <text x="0" y={p.s.kind === "STOP" ? 33 : 17} textAnchor="middle" fontSize="11" fill={k.color} fontWeight="600">
                          {p.s.kind === "BOARDING" && `${fmtTime(p.s.dep)} se chalegi`}
                          {p.s.kind === "DROP" && `${fmtTime(p.s.arr)} pahunchegi`}
                          {p.s.kind === "STOP" && `${fmtTime(p.s.arr)} – ${fmtTime(p.s.dep)}`}
                        </text>
                        {p.s.meal && <text x="0" y="43" textAnchor="middle" fontSize="10" fill="#b45309">🍽️ refreshment 15m</text>}
                      </g>
                      <text x={p.x} y={p.y + 26} textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="600">{p.s.km} km</text>
                    </motion.g>
                  );
                })}

                {/* expected bus position (schedule-based) */}
                {nowInfo?.pos && (
                  <motion.g animate={{ x: nowInfo.pos.x, y: nowInfo.pos.y }} transition={{ type: "spring", stiffness: 60, damping: 14 }}>
                    <ellipse cx="0" cy="10" rx="20" ry="6" fill="rgba(15,76,129,0.25)" />
                    <text x="0" y="2" textAnchor="middle" fontSize="30">🚌</text>
                    <circle cx="0" cy="0" r="17" fill="none" stroke="#F4A100" strokeWidth="2" opacity="0.7">
                      <animate attributeName="r" values="14;24;14" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;0.1;0.8" dur="2s" repeatCount="indefinite" />
                    </circle>
                  </motion.g>
                )}
              </svg>
            </div>
          </div>
        </div>
        {/* Expected position strip */}
        {nowInfo ? (
          <div className="border-t border-saffron-100 bg-saffron-50 px-5 py-3 text-sm text-saffron-800">
            ⏱️ <b>Abhi schedule ke mutabik:</b> bus{" "}
            {nowInfo.prev ? <><b>{nowInfo.prev.name}</b> se nikal chuki</> : "start hone wali"} —{" "}
            {nowInfo.next ? <>agla station <b>{nowInfo.next.name}</b>, lagbhag <b>{fmtTime(nowInfo.next.arr)}</b> pe pahunchegi</> : "safar poora hone wala hai"}
            {" "}({nowInfo.kmNow} / {Math.round(route.distance_km)} km cover).
            <span className="block text-xs text-saffron-600">Ye scheduled timetable ke hisaab se estimate hai (live GPS nahi).</span>
          </div>
        ) : (
          <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-sm text-slate-500">
            🕐 Ye bus abhi chali nahi / safar complete ho chuka — saare stations ki <b>scheduled timings</b> neeche hain.
          </div>
        )}
      </motion.div>

      {/* Station-wise timetable */}
      <h2 className="mt-7 font-display text-lg font-bold">📋 Station-wise timetable</h2>
      <div className="mt-3 space-y-0">
        {stops.map((s, i) => {
          const k = KIND[s.kind];
          return (
            <motion.div key={s.seq} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * i }} className="relative flex gap-4">
              {/* timeline spine */}
              <div className="flex w-8 flex-col items-center">
                <span className="z-10 mt-4 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-card" style={{ background: k.color }}>
                  {s.kind === "BOARDING" ? <MapPin size={14} /> : s.kind === "DROP" ? <Flag size={14} /> : <BusFront size={14} />}
                </span>
                {i < stops.length - 1 && <span className="w-1 flex-1" style={{ background: `linear-gradient(${k.color}, ${KIND[stops[i + 1].kind].color})` }} />}
              </div>
              {/* card */}
              <div className="card mb-3 flex-1 p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-[15px] font-semibold">{s.name}</h3>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: k.color }}>{k.label}</span>
                    {s.meal && <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700"><UtensilsCrossed size={10} /> Refreshment break</span>}
                  </div>
                  <span className="font-mono text-xs text-slate-400">{s.km} km</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {s.kind !== "BOARDING" && (
                    <p className="text-slate-600">🕐 Aayegi: <b className="text-brand-700">{fmtTime(s.arr)}</b></p>
                  )}
                  {s.kind !== "DROP" && (
                    <p className="text-slate-600">🚌 Chalegi: <b className="text-leaf-700">{fmtTime(s.dep)}</b></p>
                  )}
                  {s.kind === "STOP" && <p className="text-xs text-slate-400">Halt: {s.haltMin} min</p>}
                  {s.kind === "BOARDING" && <p className="text-xs text-slate-400">Yaha se bus shuru hogi</p>}
                  {s.kind === "DROP" && <p className="text-xs text-slate-400">Safar samapt — final station</p>}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-center text-xs text-brand-700">
        ℹ️ Saare time <b>scheduled</b> hain operator ke timetable ke mutabik. Traffic/mausam ki wajah se thoda farak ho sakta hai. Helpline: 1800-419-0001
      </p>
    </Page>
  );
}
