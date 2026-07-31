import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, Marker, CircleMarker, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";

const busIcon = L.divIcon({
  html: '<div style="font-size:28px;line-height:1;filter:drop-shadow(0 3px 4px rgba(0,0,0,.35))">🚌</div>',
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 18],
});
const liveDotIcon = L.divIcon({
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#F4A100;border:3px solid #fff;box-shadow:0 0 0 4px rgba(244,161,0,.3)"></div>',
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function FitView({ points, focus }) {
  const map = useMap();
  useEffect(() => {
    if (focus) { map.setView([focus.lat, focus.lng], 11, { animate: true }); return; }
    if (points?.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [36, 36] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points), JSON.stringify(focus)]);
  return null;
}

/**
 * markers: [{ lat, lng, kind: 'bus'|'live'|'city', label, sub }]
 * polylines: [{ points: [[lat,lng],...], color, dashed }]
 */
export default function BusMap({ markers = [], polylines = [], height = "60vh", focus = null, center = [22.8, 71.2], zoom = 7 }) {
  const fitPoints = polylines.length
    ? polylines.flatMap((p) => p.points)
    : markers.map((m) => [m.lat, m.lng]);

  return (
    <div style={{ height }} className="w-full overflow-hidden rounded-2xl border border-slate-200 shadow-soft">
      <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitView points={fitPoints} focus={focus} />
        {polylines.map((p, i) => (
          <Polyline key={i} positions={p.points} pathOptions={{ color: p.color || "#0F4C81", weight: 4, dashArray: p.dashed ? "7 9" : null, opacity: 0.85 }} />
        ))}
        {markers.map((m, i) =>
          m.kind === "city" ? (
            <CircleMarker key={i} center={[m.lat, m.lng]} radius={6}
              pathOptions={{ fillColor: m.color || "#0F4C81", color: "#fff", weight: 2, fillOpacity: 1 }}>
              <Tooltip permanent={m.showLabel} direction="top" offset={[0, -8]} className="font-semibold">
                {m.label}
              </Tooltip>
            </CircleMarker>
          ) : (
            <Marker key={i} position={[m.lat, m.lng]} icon={m.kind === "live" ? liveDotIcon : busIcon}>
              {(m.label || m.sub) && (
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold">{m.label}</p>
                    {m.sub && <p className="text-slate-500">{m.sub}</p>}
                  </div>
                </Popup>
              )}
            </Marker>
          )
        )}
      </MapContainer>
    </div>
  );
}
