import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Radar, Ticket, ShieldCheck, RefreshCcw, ChevronRight } from "lucide-react";
import SearchBar from "../components/SearchBar";
import { Page, Skeleton, LiveDot } from "../components/ui";
import { api, loadCities } from "../api";
import { inr, todayStr } from "../lib/format";
import { toast } from "../store";

const fadeUp = {
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.45 },
};

export default function Home() {
  const nav = useNavigate();
  const [popular, setPopular] = useState(null);
  const [cityCount, setCityCount] = useState(41);

  useEffect(() => {
    api("/trips/popular").then((d) => setPopular(d.popular)).catch(() => setPopular([]));
    loadCities().then((c) => c.length && setCityCount(c.length));
  }, []);

  return (
    <Page>
      {/* ---------- HERO ---------- */}
      <section className="relative bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-saffron/10" />
          <div className="absolute -left-32 bottom-0 h-80 w-80 rounded-full bg-brand-400/10" />
          <div className="absolute bottom-4 right-6 hidden text-7xl md:block animate-floaty">🚌</div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-14 md:pt-20">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="chip border border-saffron-400/40 bg-saffron/15 text-saffron-100">
              <LiveDot className="mr-0.5" /> 3D Route Vision — station-wise timings on every bus
            </span>
            <h1 className="mt-4 max-w-2xl font-display text-3xl font-bold leading-tight text-white md:text-5xl">
              Gujarat ki har city,<br />
              <span className="bg-gradient-to-r from-saffron-400 to-saffron-600 bg-clip-text text-transparent">ek hi booking se</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm text-brand-100 md:text-base">
              Ahmedabad to Dwarka, Surat to Somnath — intercity buses across {cityCount} Gujarat cities
              with station-wise route vision, instant e-tickets and easy cancellations.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }}
            className="card relative z-10 mt-8 p-4 md:p-5"
          >
            <SearchBar />
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-brand-100"
          >
            <span>✓ Free date changes</span><span>✓ UPI / Cards / NetBanking</span><span>✓ QR e-ticket</span><span>✓ 24×7 support</span>
          </motion.p>
        </div>
      </section>

      {/* ---------- POPULAR ROUTES ---------- */}
      <section className="mx-auto mt-12 max-w-6xl px-4">
        <motion.div {...fadeUp} className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Popular Routes</h2>
            <p className="text-sm text-slate-500">Gujarat's busiest corridors, updated daily</p>
          </div>
        </motion.div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(popular ?? Array.from({ length: 6 })).map((r, i) =>
            r ? (
              <motion.button
                key={i}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: i * 0.05 }}
                onClick={() => nav(`/search?from=${r.from.id}&to=${r.to.id}&date=${todayStr()}&pax=1`)}
                className="card group flex items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xl">🛣️</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-sm font-semibold text-ink">
                    {r.from.name} → {r.to.name}
                  </span>
                  <span className="text-xs text-slate-400">{r.distanceKm} km • from <b className="text-brand-600">{inr(r.fromFare)}</b></span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-saffron-600" />
              </motion.button>
            ) : (
              <div key={i} className="card p-4"><Skeleton className="h-11 w-full" /></div>
            )
          )}
        </div>
      </section>

      {/* ---------- STATS ---------- */}
      <section className="mx-auto mt-12 max-w-6xl px-4">
        <motion.div {...fadeUp} className="card grid grid-cols-2 divide-slate-100 bg-gradient-to-r from-brand-500 to-brand-700 text-white md:grid-cols-4 md:divide-x">
          {[
            [`${cityCount}+`, "Cities connected"],
            ["1,200+", "Trips every week"],
            ["4.6★", "Avg passenger rating"],
            ["24×7", "Customer support"],
          ].map(([big, small]) => (
            <div key={small} className="px-4 py-6 text-center">
              <p className="font-display text-2xl font-bold md:text-3xl">{big}</p>
              <p className="mt-1 text-xs font-medium text-brand-100">{small}</p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ---------- FEATURES ---------- */}
      <section className="mx-auto mt-14 max-w-6xl px-4">
        <motion.h2 {...fadeUp} className="text-center font-display text-2xl font-bold">Why travel with Gujarat Bus Seva?</motion.h2>
        <motion.p {...fadeUp} className="mx-auto mt-1 max-w-md text-center text-sm text-slate-500">
          Everything you expect from a world-class bus platform — built for Gujarat.
        </motion.p>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: <Radar size={22} />, title: "3D Route Vision", text: "Har bus ka pura rasta 3D map pe — kaun se station pe kitne baje pahunchegi, sab pehle se pata.", tone: "text-brand-500 bg-brand-50" },
            { icon: <Ticket size={22} />, title: "QR E-Tickets", text: "Instant PDF ticket with a QR code — just show your phone while boarding.", tone: "text-saffron-600 bg-saffron-50" },
            { icon: <RefreshCcw size={22} />, title: "Easy Cancellations", text: "Plans change? Cancel in one tap and get your refund automatically.", tone: "text-leaf-600 bg-leaf-50" },
            { icon: <ShieldCheck size={22} />, title: "Safe & Secure", text: "Razorpay payments, verified operators and password-secured accounts.", tone: "text-danger-600 bg-danger-50" },
          ].map((f, i) => (
            <motion.div key={f.title} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.07 }}
              className="card p-5 transition hover:-translate-y-1 hover:shadow-lift">
              <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${f.tone}`}>{f.icon}</span>
              <h3 className="mt-3 font-display text-[15px] font-semibold">{f.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{f.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------- 3D ROUTE VISION ---------- */}
      <section className="mx-auto mt-14 max-w-6xl px-4">
        <motion.div {...fadeUp} className="card overflow-hidden">
          <div className="grid md:grid-cols-2">
            <div className="p-6 md:p-9">
              <span className="chip bg-brand-50 text-brand-600">🗺️ 3D ROUTE VISION</span>
              <h2 className="mt-3 font-display text-xl font-bold md:text-2xl">Pura route pehle se dekho — har station, har time</h2>
              <ol className="mt-5 space-y-4">
                {[
                  ["Apni bus chuno", "Search results me har bus ke saath 🗺️ Route badge milta hai — seat book karne se pehle bhi dekh sakte ho."],
                  ["Station-wise timetable kholo", "Kaun se station pe kitne baje bus aayegi aur kab chalegi — halt aur 🍽️ refreshment break ke saath."],
                  ["3D route ribbon ka maza lo", "Tilted 3D map pe behti hui route line, floating station cards aur chalti hui bus — family ko bhi dikhao!"],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-saffron font-display text-xs font-bold text-ink">{i + 1}</span>
                    <div>
                      <p className="text-sm font-semibold">{t}</p>
                      <p className="text-[13px] text-slate-500">{d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="relative hidden bg-gradient-to-br from-brand-600 to-brand-900 p-8 md:block">
              <p className="text-center text-sm font-semibold text-brand-100">Ahmedabad → Surat ka asli sample 🚌</p>
              <div className="mt-6 space-y-0">
                {[
                  { name: "Ahmedabad", time: "05:45 AM", note: "se chalegi", c: "#1E8E5A", end: true },
                  { name: "Anand", time: "06:41 – 06:56 AM", note: "🍽️ 15m refreshment", c: "#38bdf8" },
                  { name: "Bharuch", time: "08:53 – 08:58 AM", note: "5m halt", c: "#38bdf8" },
                  { name: "Ankleshwar", time: "09:09 – 09:14 AM", note: "5m halt", c: "#38bdf8" },
                  { name: "Surat", time: "10:14 AM", note: "pahunchegi 🏁", c: "#F4A100", end: true },
                ].map((s, i, arr) => (
                  <motion.div key={s.name} initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.18 }} className="relative flex items-center gap-3 pl-1">
                    <div className="flex w-5 flex-col items-center">
                      <span className="z-10 block rounded-full border-2 border-white" style={{ background: s.c, width: s.end ? 14 : 10, height: s.end ? 14 : 10, margin: s.end ? 3 : 5 }} />
                      {i < arr.length - 1 && <span className="h-8 w-0.5 bg-white/25" />}
                    </div>
                    <div className={`flex-1 rounded-xl bg-white/10 px-3 py-2 backdrop-blur ${i < arr.length - 1 ? "mb-1.5" : ""}`}>
                      <p className="text-[13px] font-bold text-white">{s.name} <span className="ml-1 font-semibold text-brand-100">• {s.time}</span></p>
                      <p className="text-[11px] text-brand-200">{s.note}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <p className="mt-5 text-center text-xs text-brand-200">Har bus ke liye aisa hi pura plan — time ke saath ✨</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="mx-auto mt-14 max-w-6xl px-4">
        <motion.div {...fadeUp} className="card flex flex-col items-center gap-4 bg-gradient-to-r from-saffron-500 to-saffron-600 p-8 text-center md:p-10">
          <h2 className="font-display text-2xl font-bold text-ink">Ready to roll across Gujarat?</h2>
          <p className="max-w-md text-sm text-ink/70">Over 1,200 weekly departures. Book in under a minute — no account passwords, just your mobile number.</p>
          <button onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); toast.info("Search for your route above 👆"); }} className="btn bg-brand-700 text-white hover:bg-brand-800">
            Book your seat now
          </button>
        </motion.div>
      </section>
    </Page>
  );
}
