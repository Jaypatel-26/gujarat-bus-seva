import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Flag, UtensilsCrossed, BusFront } from "lucide-react";
import { api, busTypeLabel } from "../api";
import { Page, Skeleton, Badge } from "../components/ui";
import { fmtTime, fmtDate, minsToText, inr } from "../lib/format";

const KIND = {
  BOARDING: { color: "#1E8E5A", label: "Boarding" },
  STOP: { color: "#0F4C81", label: "Halt" },
  DROP: { color: "#F4A100", label: "Drop" },
};

// 3D tilt maths — the road SVG is rotateX(38°) about its bottom edge.
// Stations/bus use the SAME maths so they sit exactly on the tilted road.
const COS = Math.cos((38 * Math.PI) / 180); // 0.788
const sx = (x) => x / 10; // 0..1000 -> %
const sy = (y) => (1 - (1 - y / 300) * COS) * 100; // 0..300 -> tilted %

function pointAtFraction(pts, totalKm, f) {
  const kmNow = f * totalKm;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (kmNow >= a.s.km && kmNow <= b.s.km) {
      const t = (kmNow - a.s.km) / Math.max(1, b.s.km - a.s.km);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y };
}

function StationBillboard({ p, side, idx }) {
  const k = KIND[p.s.kind];
  const isEnd = p.s.kind !== "STOP";
  const anchorX = p.s.kind === "BOARDING" ? "translateX(-12%)" : p.s.kind === "DROP" ? "translateX(-88%)" : "translateX(-50%)";
  const lift = side === "above" ? "translateY(-100%)" : "";

  const card = (
    <motion.div
      initial={{ opacity: 0, y: side === "above" ? 12 : -12, scale: 0.75 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ scale: 1.14, rotateX: 10, y: side === "above" ? -6 : 6, boxShadow: "0 22px 44px -10px rgba(15,76,129,0.45)" }}
      transition={{ delay: 0.5 + idx * 0.15, type: "spring", stiffness: 210, damping: 17 }}
      className="flex w-[150px] cursor-pointer flex-col justify-center rounded-xl border-2 bg-white/95 px-2.5 py-2 text-center shadow-lift backdrop-blur"
      style={{ borderColor: k.color, transformStyle: "preserve-3d" }}
    >
      <p className="truncate text-[13.5px] font-bold text-slate-800">{p.s.name}</p>
      <p className="text-[11px] font-semibold leading-snug" style={{ color: k.color }}>
        {p.s.kind === "BOARDING" && `${fmtTime(p.s.dep)} se chalegi`}
        {p.s.kind === "DROP" && `${fmtTime(p.s.arr)} pahunchegi`}
        {p.s.kind === "STOP" && `${fmtTime(p.s.arr)} – ${fmtTime(p.s.dep)}`}
      </p>
      {p.s.meal && <p className="text-[9.5px] font-semibold text-amber-600">🍽️ refreshment 15m</p>}
      {p.s.km > 0 && <p className="text-[9px] font-semibold text-slate-400">{p.s.km} km from start</p>}
    </motion.div>
  );

  const pole = <span className="pointer-events-none block w-0.5 shrink-0" style={{ background: `${k.color}66`, height: 22 }} />;
  const pin = (
    <motion.span
      initial={{ scale: 0 }} animate={{ scale: 1 }}
      transition={{ delay: 0.35 + idx * 0.15, type: "spring", stiffness: 260, damping: 14 }}
      className="relative block"
    >
      <span className="absolute inset-0 animate-ping rounded-full opacity-40" style={{ background: k.color }} />
      <span
        className="relative block rounded-full border-[3px] border-white shadow-card"
        style={{ background: k.color, width: isEnd ? 16 : 12, height: isEnd ? 16 : 12 }}
      />
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

export default function RouteVision() {
  const { id, tripId } = useParams();
  const tid = id || tripId;
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setData(null); setErr("");
    api(`/trips/${tid}/route`).then(setData).catch((e) => setErr(e.message));
  }, [tid]);

  const geo = useMemo(() => {
    if (!data) return null;
    const X0 = 80, X1 = 920;
    const total = data.route.distance_km || 1;
    const pts = data.stops.map((s, i) => {
      const x = X0 + (s.km / total) * (X1 - X0);
      const y = 170 + (i === 0 || i === data.stops.length - 1 ? 0 : Math.sin(i * 1.9) * 30);
      return { x, y, s };
    });
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const mx = (pts[i - 1].x + pts[i].x) / 2, my = (pts[i - 1].y + pts[i].y) / 2;
      path += ` Q ${pts[i - 1].x} ${pts[i - 1].y}, ${mx} ${my}`;
    }
    path += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
    return { pts, path, total };
  }, [data]);

  const nowInfo = useMemo(() => {
    if (!data) return null;
    const dep = new Date(data.trip.departure_time).getTime();
    const arr = new Date(data.trip.arrival_time).getTime();
    const now = Date.now();
    if (now < dep || now > arr) return null;
    const f = Math.min(1, Math.max(0, (now - dep) / (arr - dep)));
    return {
      f,
      kmNow: Math.round(f * data.route.distance_km),
      next: data.stops.find((s) => new Date(s.arr || s.dep).getTime() > now),
      prev: [...data.stops].reverse().find((s) => new Date(s.dep || s.arr).getTime() <= now),
    };
  }, [data]);

  const targetF = nowInfo ? nowInfo.f : 1;
  const busPos = useMemo(() => (geo ? pointAtFraction(geo.pts, geo.total, targetF) : null), [geo, targetF]);
  const midPos = useMemo(() => (geo ? pointAtFraction(geo.pts, geo.total, Math.min(targetF, 0.45)) : null), [geo, targetF]);

  if (err) return <Page className="mx-auto max-w-3xl px-4 py-10"><div className="card p-6 text-center font-medium text-danger-600">{err}</div></Page>;
  if (!data || !geo || !busPos) {
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

        <div className="overflow-x-auto bg-gradient-to-b from-sky-100 via-[#eaf4fd] to-white">
          <div className="relative mx-auto h-[440px] min-w-[780px] max-w-4xl">
            {/* sun */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }}
              className="absolute right-[8%] top-[5%] h-16 w-16 rounded-full bg-gradient-to-br from-amber-200 to-saffron-400 opacity-80 blur-[2px]"
              style={{ boxShadow: "0 0 60px 24px rgba(244,161,0,0.35)" }}
            />
            {/* drifting clouds */}
            {[
              { top: "9%", size: 90, dur: 34, delay: 0 },
              { top: "21%", size: 60, dur: 46, delay: 9 },
            ].map((c, i) => (
              <motion.div key={i}
                initial={{ x: "-15vw", opacity: 0 }}
                animate={{ x: "62vw", opacity: [0, 0.85, 0.85, 0] }}
                transition={{ duration: c.dur, delay: c.delay, repeat: Infinity, ease: "linear" }}
                className="absolute rounded-full bg-white/80 blur-md"
                style={{ top: c.top, width: c.size, height: c.size * 0.42 }}
              />
            ))}

            {/* tilted ground + road */}
            <div className="absolute inset-x-[2%] bottom-0 top-[14%]">
              <div
                className="absolute inset-0 rounded-3xl"
                style={{
                  transform: "rotateX(38deg)",
                  transformOrigin: "50% 100%",
                  backgroundImage:
                    "linear-gradient(rgba(15,76,129,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(15,76,129,0.09) 1px, transparent 1px), radial-gradient(ellipse at 50% 0%, rgba(30,142,90,0.10), transparent 70%)",
                  backgroundSize: "46px 46px, 46px 46px, 100% 100%",
                  boxShadow: "inset 0 -40px 80px rgba(15,76,129,0.10), inset 0 20px 60px rgba(255,255,255,0.6)",
                }}
              />
              <svg viewBox="0 0 1000 300" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" style={{ transform: "rotateX(38deg)", transformOrigin: "50% 100%" }}>
                <defs>
                  <linearGradient id="rvLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#1E8E5A" />
                    <stop offset="55%" stopColor="#0F4C81" />
                    <stop offset="100%" stopColor="#F4A100" />
                  </linearGradient>
                  <filter id="rvBlur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" /></filter>
                </defs>

                <path d={geo.path} fill="none" stroke="rgba(15,76,129,0.22)" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" filter="url(#rvBlur)" transform="translate(5,16)" />
                <motion.path d={geo.path} fill="none" stroke="#ffffff" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: "easeInOut" }} />
                <motion.path d={geo.path} fill="none" stroke="url(#rvLine)" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease: "easeInOut", delay: 0.15 }} />
                <path d={geo.path} fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"
                  strokeDasharray="2 20" className="dashmove" opacity="0.9" />
              </svg>

              {/* upright station billboards (maths-aligned to the tilted road, zero overlap) */}
              {geo.pts.map((p, i) => {
                const isEnd = i === 0 || i === geo.pts.length - 1;
                const side = isEnd ? "above" : i % 2 === 0 ? "below" : "above";
                return <StationBillboard key={p.s.seq} p={p} side={side} idx={i} />;
              })}

              {/* driving bus */}
              {midPos && (
                <motion.div
                  className="absolute z-10"
                  initial={{ left: `${sx(midPos.x)}%`, top: `${sy(midPos.y)}%` }}
                  animate={{ left: `${sx(busPos.x)}%`, top: `${sy(busPos.y)}%` }}
                  transition={{ duration: 2.6, ease: "easeInOut", delay: 0.6 }}
                  style={{ transform: "translate(-50%, -92%)" }}
                >
                  <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }} className="text-center">
                    <span className="block text-[34px] leading-none drop-shadow-[0_8px_8px_rgba(15,76,129,0.35)]">🚌</span>
                  </motion.div>
                  <span className="mx-auto block h-2 w-8 rounded-[50%] bg-brand-900/20 blur-[3px]" />
                </motion.div>
              )}
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
            <span className="block text-xs text-saffron-600">Ye scheduled timetable ke hisaab se estimate hai.</span>
          </div>
        ) : (
          <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-sm text-slate-500">
            🕐 Saare stations ki <b>scheduled timings</b> neeche hain — journey se pehle pura plan dekh lo.
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
              <div className="flex w-8 flex-col items-center">
                <span className="z-10 mt-4 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-card" style={{ background: k.color }}>
                  {s.kind === "BOARDING" ? <MapPin size={14} /> : s.kind === "DROP" ? <Flag size={14} /> : <BusFront size={14} />}
                </span>
                {i < stops.length - 1 && <span className="w-1 flex-1" style={{ background: `linear-gradient(${k.color}, ${KIND[stops[i + 1].kind].color})` }} />}
              </div>
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
                  {s.kind !== "BOARDING" && <p className="text-slate-600">🕐 Aayegi: <b className="text-brand-700">{fmtTime(s.arr)}</b></p>}
                  {s.kind !== "DROP" && <p className="text-slate-600">🚌 Chalegi: <b className="text-leaf-700">{fmtTime(s.dep)}</b></p>}
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
