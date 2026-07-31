export const fmtTime = (d) =>
  new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

export const fmtDate = (d, opts) =>
  new Date(d).toLocaleDateString("en-IN", opts || { weekday: "short", day: "numeric", month: "short" });

export const fmtDateTime = (d) => `${fmtDate(d)} • ${fmtTime(d)}`;

export const minsToText = (m) => {
  const h = Math.floor(m / 60);
  return h ? `${h}h ${String(Math.round(m % 60)).padStart(2, "0")}m` : `${Math.round(m)}m`;
};

export const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export function todayStr(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const statusTone = (s) =>
  ({ CONFIRMED: "green", CANCELLED: "red", PENDING: "amber", SCHEDULED: "slate", IN_PROGRESS: "green", COMPLETED: "blue" }[s] || "slate");

export const statusLabel = (s) =>
  ({ IN_PROGRESS: "Live", SCHEDULED: "Scheduled", COMPLETED: "Completed", CANCELLED: "Cancelled", CONFIRMED: "Confirmed", PENDING: "Payment Pending" }[s] || s);
