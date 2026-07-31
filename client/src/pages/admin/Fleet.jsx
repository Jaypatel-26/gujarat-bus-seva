import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { socket } from "../../socket";
import { Page, Skeleton, EmptyState, LiveDot } from "../../components/ui";
import BusMap from "../../components/BusMap";

export default function Fleet() {
  const [fleet, setFleet] = useState(null);
  const [positions, setPositions] = useState({}); // tripId -> {lat,lng}
  const [focus, setFocus] = useState(null);

  useEffect(() => {
    api("/admin/fleet").then((d) => setFleet(d.fleet)).catch(() => setFleet([]));
    const t = setInterval(() => api("/admin/fleet").then((d) => setFleet(d.fleet)).catch(() => {}), 15000);
    socket.emit("joinFleet");
    const onFleet = (items) => {
      setPositions((prev) => {
        const next = { ...prev };
        for (const it of items) next[it.tripId] = { lat: it.lat, lng: it.lng };
        return next;
      });
    };
    socket.on("fleet", onFleet);
    return () => { clearInterval(t); socket.off("fleet", onFleet); };
  }, []);

  const markers = useMemo(() => {
    if (!fleet) return [];
    return fleet.map((t) => {
      const pos = positions[t.id] || (t.liveLocation ? { lat: t.liveLocation.latitude, lng: t.liveLocation.longitude } : { lat: t.route.fromCity.lat, lng: t.route.fromCity.lng });
      return {
        lat: pos.lat, lng: pos.lng, kind: "bus",
        label: `${t.route.fromCity.name} → ${t.route.toCity.name}`,
        sub: `${t.bus.bus_number} • ${t.bus.operator_name}${t.driver?.name ? ` • ${t.driver.name}` : ""}`,
      };
    });
  }, [fleet, positions]);

  if (!fleet) return <Skeleton className="h-[70vh] w-full" />;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-[15px] font-semibold">
          Live Fleet Map {fleet.length > 0 && <LiveDot />}
        </h3>
        <span className="text-xs font-semibold text-slate-400">{fleet.length} bus{fleet.length !== 1 ? "es" : ""} on the road</span>
      </div>

      {fleet.length === 0 ? (
        <EmptyState icon="🅿️" title="No buses live right now"
          subtitle="Start a trip from the Driver Console (login: 9000000002) and watch it appear here in real time." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr,280px]">
          <BusMap markers={markers} height="66vh" focus={focus} />
          <div className="space-y-2">
            {fleet.map((t) => (
              <button key={t.id} onClick={() => setFocus(positions[t.id] || (t.liveLocation ? { lat: t.liveLocation.latitude, lng: t.liveLocation.longitude } : null))}
                className="card w-full p-3 text-left transition hover:border-brand-200 hover:shadow-lift">
                <p className="text-sm font-semibold">{t.route.fromCity.name} → {t.route.toCity.name}</p>
                <p className="mt-0.5 text-xs text-slate-400">{t.bus.bus_number} • {t.driver?.name || "Driver"} • {t._count.bookings} bookings</p>
                {t.liveLocation && <p className="mt-1 text-[11px] font-semibold text-leaf-600">⚡ {Math.round(t.liveLocation.speed)} km/h • {Math.round((t.liveLocation.progress || 0) * 100)}% covered</p>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
