import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Database, ClipboardList, Radar } from "lucide-react";

const NAV = [
  { to: "/admin", end: true, icon: <LayoutDashboard size={16} />, label: "Dashboard" },
  { to: "/admin/data", icon: <Database size={16} />, label: "Routes & Fleet" },
  { to: "/admin/bookings", icon: <ClipboardList size={16} />, label: "Bookings" },
  { to: "/admin/fleet", icon: <Radar size={16} />, label: "Live Fleet Map" },
];

export default function AdminLayout() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 md:flex-row">
      <aside className="md:w-52 md:shrink-0">
        <div className="card flex gap-1 overflow-x-auto p-2 md:sticky md:top-20 md:flex-col">
          {NAV.map((n) => (
            <NavLink
              key={n.to} to={n.to} end={n.end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-brand-500 text-white shadow-card" : "text-slate-600 hover:bg-brand-50 hover:text-brand-600"
                }`
              }
            >
              {n.icon} {n.label}
            </NavLink>
          ))}
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
