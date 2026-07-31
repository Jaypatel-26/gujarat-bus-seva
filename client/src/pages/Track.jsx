import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, busTypeLabel } from "../api";
import { socket } from "../socket";
import { fmtTime, fmtDate, statusLabel } from "../lib/format";
import { Page, Badge, Skeleton, EmptyState, LiveDot } from "../components/ui";
import BusMap from "../components/BusMap";
import { toast } from "../store";

export default function Track() {
  const { tripId } = useParams();
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState(null);
  const [loc, setLoc] = useState(null); // {lat,lng,speed,progress,nextStop,etaMinutes}
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    api(`/trips/${tripId}`)
      .then((t) => {
        setTrip(t);
        if (t.liveLocation) {
          setLoc({ lat: t.liveLocation.latitude, lng: t.liveLocation.longitude, speed: t.liveLocation.speed, progress: t.liveLocation.progress });
        }
      })
      .catch((e) => setError(e.message));
  }, [tripId]);

  useEffect(() => {
    socket.emit("joinTrip", Number(tripId));
    const onLoc = (payload) => setLoc(payload);
    const onEnd = ({ status }) => {
      setEnded(true);
      toast.info(status === "COMPLETED" ? "🏁 Bus has arrived at the destination" : "Trip ended");
    };
    socket.on("location", onLoc);
    socket.on("trip:ended", onEnd);
    return () => {
      socket.emit("leaveTrip", Number(tripId));
      socket.off("location", onLoc);
      socket.off("trip:ended", onEnd);
    };
  }, [tripId]);

  const markers = useMemo(() => {
    if (!trip) return [];
    const { fromCity, toCity } = trip.route;
    const m = [
      { lat: fromCity.lat, lng: fromCity.lng, kind: "city", label: `${fromCity.name} (boarding)`, showLabel: true },
      { lat: toCity.lat, lng: toCity.lng, kind: "city", label: `${toCity.name} (drop)`, color: "#F4A100", showLabel: true },
    ];
    if (loc) m.push({ lat: loc.lat, lng: loc.lng, kind: "bus", label: `${trip.bus.operator_name}`, sub: `${trip.bus.bus_number} • ${loc.speed || 0} km/h` });
    return m;
  }, [trip, loc]);

  if (error) return <Page className="mx-auto max-w-5xl px-4 py-8"><EmptyState icon="🛰️" title="Couldn't load tracking" subtitle={error} /></Page>;
  if (!trip) return <Page className="mx-auto max-w-5xl px-4 py-6"><Skeleton className="h-[70vh] w-full" /></Page>;

  const r = trip.route;
  const isLive = loc && !ended && trip.status === "IN_PROGRESS";
  const progress = Math.round((loc?.progress || 0) * 100);

  return (
    <Page className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-xl font-bold md:text-2xl">
            {r.fromCity.name} <span className="text-saffron-600">→</span> {r.toCity.name}
            {isLive && <LiveDot />}
          </h1>
          <p className="text-sm text-slate-500">
            {trip.bus.operator_name} • {trip.bus.bus_number} • {busTypeLabel(trip.bus.type)} • {fmtDate(trip.date)}
          </p>
        </div>
        <Badge tone={ended || trip.status === "COMPLETED" ? "blue" : isLive ? "green" : "amber"}>
          {statusLabel(ended ? "COMPLETED" : trip.status)}
        </Badge>
      </div>

      <div className="relative">
        <BusMap
          markers={markers}
          polylines={[{ points: [[r.fromCity.lat, r.fromCity.lng], [r.toCity.lat, r.toCity.lng]], dashed: true }]}
          height="62vh"
        />
        {!isLive && trip.status === "SCHEDULED" && (
          <div className="absolute inset-x-4 bottom-4 z-10 mx-auto max-w-md card border border-saffron-400/40 bg-white/95 p-3 text-center text-sm">
            ⏱️ <b>Bus hasn't started yet.</b> Departure at {fmtTime(trip.departure_time)} — the live location will appear here automatically once the driver starts the trip.
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <StatTile icon="⚡" label="Current speed" value={loc ? `${loc.speed || 0} km/h` : "—"} />
        <StatTile icon="🚏" label="Next stop" value={loc?.nextStop || r.toCity.name} />
        <StatTile icon="⏳" label="ETA to destination" value={loc?.etaMinutes != null && !ended ? `${loc.etaMinutes} min` : ended || trip.status === "COMPLETED" ? "Arrived" : "—"} />
      </div>

      <div className="card mt-3 p-5">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>{r.fromCity.name}</span>
          <span className="text-brand-600">{progress}% covered</span>
          <span>{r.toCity.name}</span>
        </div>
        <div className="relative mt-2 h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-saffron-500 transition-all duration-1000" style={{ width: `${Math.max(2, progress)}%` }} />
          <span className="absolute -top-2.5 text-lg transition-all duration-1000" style={{ left: `calc(${Math.max(0, progress - 2)}% )` }}>🚌</span>
        </div>
        <div className="mt-5 flex items-center justify-between gap-2 overflow-x-auto text-xs">
          <Step done label={`Departed ${r.fromCity.name}`} sub={fmtTime(trip.departure_time)} active={!loc && trip.status === "SCHEDULED"} />
          <Line done={progress > 10} />
          <Step done={progress > 10} active={isLive && loc?.nextStop && loc.nextStop !== r.toCity.name} label={loc?.nextStop && loc.nextStop !== r.toCity.name ? `Next: ${loc.nextStop}` : "En route"} sub="on time" />
          <Line done={ended || trip.status === "COMPLETED"} />
          <Step done={ended || trip.status === "COMPLETED"} label={`Arrive ${r.toCity.name}`} sub={fmtTime(trip.arrival_time)} />
        </div>
      </div>
    </Page>
  );
}

const StatTile = ({ icon, label, value }) => (
  <div className="card flex items-center gap-3 p-4">
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-lg">{icon}</span>
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-display text-base font-bold">{value}</p>
    </div>
  </div>
);
const Step = ({ done, active, label, sub }) => (
  <div className="flex min-w-[120px] flex-col items-center text-center">
    <span className={`mb-1 h-3.5 w-3.5 rounded-full border-2 ${done ? "border-leaf bg-leaf" : active ? "animate-pulse border-saffron-500 bg-saffron-400" : "border-slate-300 bg-white"}`} />
    <p className={`font-semibold ${done || active ? "text-ink" : "text-slate-400"}`}>{label}</p>
    <p className="text-slate-400">{sub}</p>
  </div>
);
const Line = ({ done }) => <div className={`h-0.5 w-full min-w-[30px] rounded ${done ? "bg-leaf" : "bg-slate-200"}`} />;
