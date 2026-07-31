import { useAuth } from "./store";

// Render may inject a bare host (no scheme) — normalize it.
const raw = import.meta.env.VITE_API_URL || "";
export const API = raw && !/^https?:\/\//.test(raw) ? `https://${raw}` : raw;

export async function api(path, { method = "GET", body } = {}) {
  const token = useAuth.getState().token;
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Cities are static — cache once per session.
let citiesPromise = null;
export function loadCities() {
  if (!citiesPromise) {
    citiesPromise = api("/cities").then((d) => d.cities).catch(() => {
      citiesPromise = null;
      return [];
    });
  }
  return citiesPromise;
}

export const busTypeLabel = (t) =>
  ({ AC_SEATER: "AC Seater", NON_AC_SEATER: "Non-AC Seater", SEMI_SLEEPER: "Semi Sleeper", AC_SLEEPER: "AC Sleeper" }[t] || t);
