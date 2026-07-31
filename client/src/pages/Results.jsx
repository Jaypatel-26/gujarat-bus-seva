import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api, loadCities } from "../api";
import { fmtDate, minsToText } from "../lib/format";
import { Page, Badge, EmptyState, Skeleton } from "../components/ui";
import SearchBar from "../components/SearchBar";
import TripCard, { TripCardSkeleton } from "../components/TripCard";
import { toast } from "../store";

const FILTERS = [
  { id: "ALL", label: "All buses" },
  { id: "AC", label: "AC" },
  { id: "NON_AC", label: "Non-AC" },
  { id: "SLEEPER", label: "Sleeper" },
  { id: "SEMI_SLEEPER", label: "Semi Sleeper" },
];

export default function Results() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const from = params.get("from"), to = params.get("to"), date = params.get("date");
  const pax = Number(params.get("pax") || 1);

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [sort, setSort] = useState("departure");
  const [modify, setModify] = useState(false);
  const [citiesReady, setCitiesReady] = useState(null);

  useEffect(() => {
    loadCities().then(setCitiesReady);
  }, []);

  useEffect(() => {
    if (!from || !to || !date) return;
    setLoading(true); setError(null); setData(null);
    api(`/trips/search?from=${from}&to=${to}&date=${date}&pax=${pax}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to, date, pax]);

  const trips = useMemo(() => {
    if (!data) return [];
    let list = data.trips.filter((t) => {
      if (filter === "AC") return t.bus.type.startsWith("AC");
      if (filter === "NON_AC") return t.bus.type === "NON_AC_SEATER";
      if (filter === "SLEEPER") return t.bus.type === "AC_SLEEPER";
      if (filter === "SEMI_SLEEPER") return t.bus.type === "SEMI_SLEEPER";
      return true;
    });
    if (sort === "fare") list = [...list].sort((a, b) => a.fare - b.fare);
    if (sort === "duration") list = [...list].sort((a, b) => a.durationMin - b.durationMin);
    if (sort === "seats") list = [...list].sort((a, b) => b.seatsLeft - a.seatsLeft);
    return list;
  }, [data, filter, sort]);

  const route = data?.route;
  const fromCity = citiesReady?.find((c) => c.id === Number(from));
  const toCity = citiesReady?.find((c) => c.id === Number(to));

  return (
    <Page className="mx-auto max-w-5xl px-4 py-6">
      {/* summary header */}
      <div className="card mb-4 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {loading && !route ? (
              <Skeleton className="h-7 w-64" />
            ) : (
              <>
                <h1 className="font-display text-xl font-bold text-ink md:text-2xl">
                  {(route?.from.name || "…")} <span className="text-saffron-600">→</span> {(route?.to.name || "…")}
                </h1>
                <p className="mt-0.5 text-sm text-slate-500">
                  {fmtDate(date, { weekday: "long", day: "numeric", month: "long" })} • {pax} passenger{pax > 1 ? "s" : ""}
                  {route && <> • {route.distanceKm} km</>}
                  {data && <> • <b className="text-brand-600">{data.trips.length} buses found</b></>}
                </p>
              </>
            )}
          </div>
          <button className="btn-ghost" onClick={() => setModify((m) => !m)}>{modify ? "Close ✕" : "✏️ Modify search"}</button>
        </div>
        <AnimatePresence>
          {modify && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-slate-100 pt-4 mt-4">
                <SearchBar compact initial={{ from: fromCity, to: toCity, date, pax }} onSearched={() => setModify(false)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`chip px-3.5 py-1.5 transition ${filter === f.id ? "bg-brand-500 text-white" : "bg-white text-slate-500 shadow-soft hover:bg-brand-50"}`}>
            {f.label}
          </button>
        ))}
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="input ml-auto w-44 py-1.5 text-xs">
          <option value="departure">Sort: Departure time</option>
          <option value="fare">Sort: Lowest fare</option>
          <option value="duration">Sort: Fastest</option>
          <option value="seats">Sort: Most seats left</option>
        </select>
      </div>

      {/* results */}
      {error && <EmptyState icon="😕" title="Couldn't load buses" subtitle={error} />}
      {loading && <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <TripCardSkeleton key={i} />)}</div>}
      {!loading && !error && data && (
        trips.length ? (
          <div className="space-y-3">
            {trips.map((t, i) => (
              <TripCard key={t.id} trip={t} index={i} rating={data.rating}
                onSelect={(trip) => nav(`/trip/${trip.id}?date=${date}&pax=${pax}`)} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="🚏"
            title="No buses match this filter"
            subtitle="Try a different bus type or pick another date — new trips are added every day."
          >
            <button className="btn-primary mt-2" onClick={() => setFilter("ALL")}>Clear filters</button>
          </EmptyState>
        )
      )}
      {!loading && data && (
        <p className="mt-6 text-center text-xs text-slate-400">
          Fares include GST. Boarding point details are shared on your e-ticket. Need help? Call 1800-419-0001.
        </p>
      )}
    </Page>
  );
}
