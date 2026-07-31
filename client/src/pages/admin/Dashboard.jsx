import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart, Bar } from "recharts";
import { api } from "../../api";
import { inr, fmtDate, statusTone, statusLabel } from "../../lib/format";
import { Badge, Skeleton, LiveDot } from "../../components/ui";

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const load = () => api("/admin/stats").then(setStats).catch(() => {});
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  if (!stats) {
    return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="🎟️" label="Bookings today" value={stats.bookingsToday} sub={`${stats.tripsToday} trips scheduled today`} />
        <StatCard icon="💰" label="Revenue today" value={inr(stats.revenueToday)} sub="successful payments" accent="text-leaf-600" />
        <StatCard icon="🚌" label="Trips in progress" value={<span className="flex items-center gap-2">{stats.activeBuses} {stats.activeBuses > 0 && <LiveDot />}</span>} sub="started by conductor" />
        <StatCard icon="👥" label="Registered users" value={stats.usersCount} sub="passengers + staff" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="font-display text-[15px] font-semibold">Revenue — last 14 days</h3>
          <p className="mb-3 text-xs text-slate-400">Successful payments (₹)</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.revenueSeries} margin={{ left: 0, right: 8, top: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={2} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} width={50} tickFormatter={(v) => `₹${(v / 1000).toFixed(1)}k`} />
                <Tooltip formatter={(v) => [inr(v), "Revenue"]} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
                <Line type="monotone" dataKey="revenue" stroke="#0F4C81" strokeWidth={2.5} dot={{ r: 2.5, fill: "#F4A100", strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-display text-[15px] font-semibold">Top routes</h3>
          <p className="mb-3 text-xs text-slate-400">By confirmed bookings</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.topRoutes} layout="vertical" margin={{ left: 8, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: "#475569" }} width={130} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
                <Bar dataKey="count" fill="#F4A100" radius={[0, 6, 6, 0]} name="Bookings" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto p-5">
        <h3 className="mb-3 font-display text-[15px] font-semibold">Recent bookings</h3>
        <table className="w-full min-w-[560px]">
          <thead><tr><th className="th">PNR</th><th className="th">Passenger</th><th className="th">Route</th><th className="th">Journey</th><th className="th">Amount</th><th className="th">Status</th></tr></thead>
          <tbody>
            {stats.recentBookings.map((b) => (
              <tr key={b.pnr}>
                <td className="td font-mono text-xs font-semibold">{b.pnr}</td>
                <td className="td">{b.user}</td>
                <td className="td">{b.route}</td>
                <td className="td">{fmtDate(b.date)}</td>
                <td className="td font-semibold">{inr(b.total)}</td>
                <td className="td"><Badge tone={statusTone(b.status)}>{statusLabel(b.status)}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const StatCard = ({ icon, label, value, sub, accent = "text-brand-600" }) => (
  <div className="card p-4">
    <div className="flex items-center justify-between">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <span className="text-xl">{icon}</span>
    </div>
    <p className={`mt-1 font-display text-2xl font-bold ${accent}`}>{value}</p>
    <p className="text-[11px] text-slate-400">{sub}</p>
  </div>
);
