import { useState, useRef, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bus, Menu, X, ChevronDown, LogOut, Ticket, LayoutDashboard, Radar } from "lucide-react";
import { useAuth, toast } from "../store";

const linkCls = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? "bg-brand-50 text-brand-600" : "text-slate-600 hover:bg-slate-100 hover:text-brand-600"}`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenuOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const doLogout = () => {
    logout();
    setMenuOpen(false);
    toast.info("Logged out. See you soon! 👋");
    nav("/");
  };

  const links = (
    <>
      <NavLink to="/" className={linkCls} end>Home</NavLink>
      <NavLink to="/bookings" className={linkCls}>My Bookings</NavLink>
      {user?.role === "ADMIN" && <NavLink to="/admin" className={linkCls}>Admin Panel</NavLink>}
      {(user?.role === "DRIVER" || user?.role === "ADMIN") && <NavLink to="/driver" className={linkCls}>Conductor</NavLink>}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-xl shadow-card">🚌</span>
          <span>
            <span className="block font-display text-[17px] font-bold leading-tight text-brand-700">Gujarat Bus Seva</span>
            <span className="hidden text-[10px] font-medium uppercase tracking-wider text-saffron-600 sm:block">Gujarat ki har city, ek hi booking se</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">{links}</nav>

        <div className="flex items-center gap-2">
          {!user ? (
            <Link to="/login" className="btn-primary">Login / Signup</Link>
          ) : (
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 transition hover:border-brand-300">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 font-display text-sm font-bold text-white">
                  {(user.name || "U")[0].toUpperCase()}
                </span>
                <span className="hidden max-w-[110px] truncate text-sm font-semibold sm:block">{user.name}</span>
                <ChevronDown size={15} className="text-slate-400" />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.98 }}
                    transition={{ duration: 0.14 }}
                    className="absolute right-0 top-12 w-56 card border border-slate-100 p-2"
                  >
                    <div className="rounded-lg bg-mist px-3 py-2">
                      <p className="truncate text-sm font-semibold">{user.name}</p>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-saffron-600">{user.role}</p>
                    </div>
                    <MenuLink to="/bookings" icon={<Ticket size={15} />} onClick={() => setMenuOpen(false)}>My Bookings</MenuLink>
                    {user.role === "ADMIN" && <MenuLink to="/admin" icon={<LayoutDashboard size={15} />} onClick={() => setMenuOpen(false)}>Admin Panel</MenuLink>}
                    {(user.role === "DRIVER" || user.role === "ADMIN") && <MenuLink to="/driver" icon={<Radar size={15} />} onClick={() => setMenuOpen(false)}>Conductor Console</MenuLink>}
                    <button onClick={doLogout} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-danger-600 transition hover:bg-danger-50">
                      <LogOut size={15} /> Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden" onClick={() => setMobileOpen((o) => !o)}>
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-100 md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-3" onClick={() => setMobileOpen(false)}>{links}</div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

const MenuLink = ({ to, icon, children, onClick }) => (
  <Link to={to} onClick={onClick} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100">
    {icon} {children}
  </Link>
);

// keep Bus import used (tree-shaken otherwise) — decorative export
export const BusIcon = Bus;
