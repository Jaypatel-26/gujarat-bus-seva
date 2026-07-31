import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api";
import { Page } from "../components/ui";
import { toast, useAuth } from "../store";

const ROLES = [
  { key: "PASSENGER", label: "👤 Passenger", hint: "Mobile + Email + Password se login karo" },
  { key: "DRIVER", label: "🎫 Conductor", hint: "Conductor ID + Password se login karo" },
  { key: "ADMIN", label: "🛠️ Admin", hint: "Admin Email + Password se login karo" },
];

export default function Login() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { setAuth } = useAuth();

  const [role, setRole] = useState("PASSENGER");
  const [mode, setMode] = useState("login"); // sirf passenger ke liye signup hota hai
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [conductorId, setConductorId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const afterAuth = (d) => {
    setAuth(d.token, d.user);
    toast.ok(`Welcome, ${d.user.name || "traveller"}! 👋`);
    const next = params.get("next");
    if (next) nav(next);
    else if (d.user.role === "ADMIN") nav("/admin");
    else if (d.user.role === "DRIVER") nav("/driver");
    else nav("/");
  };

  const isEmail = (s) => /^\S+@\S+\.\S+$/.test(s.trim());

  const canSubmit =
    password.length >= (mode === "signup" ? 6 : 1) &&
    (role === "PASSENGER"
      ? mobile.replace(/\D/g, "").length === 10 && isEmail(email) && (mode === "login" || name.trim().length > 0)
      : role === "ADMIN"
        ? isEmail(email)
        : /^GJ\d{3,}$/i.test(conductorId.trim()));

  const submit = async (e) => {
    e?.preventDefault();
    setBusy(true); setError("");
    try {
      const d = mode === "signup"
        ? await api("/auth/signup", { method: "POST", body: { name, mobile, email, password } })
        : await api("/auth/login", {
            method: "POST",
            body: role === "PASSENGER"
              ? { role, mobile, email, password }
              : role === "ADMIN"
                ? { role, email, password }
                : { role, conductorId, password },
          });
      afterAuth(d);
    } catch (e2) { setError(e2.message); }
    setBusy(false);
  };

  const pickRole = (r) => {
    setRole(r);
    setError("");
    if (r !== "PASSENGER") setMode("login");
    setPassword("");
  };

  const roleInfo = ROLES.find((r) => r.key === role);

  return (
    <Page className="mx-auto flex max-w-md flex-col items-center px-4 py-10">
      <motion.div layout className="card w-full p-6">
        <div className="mb-4 text-center">
          <span className="text-4xl">🚌</span>
          <h1 className="mt-2 font-display text-xl font-bold">Login / Signup</h1>
          <p className="text-sm text-slate-500">Pehle apna role choose karo</p>
        </div>

        {/* Role selector */}
        <div className="mb-1 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-[13px] font-semibold">
          {ROLES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => pickRole(r.key)}
              className={`rounded-lg py-2.5 transition ${role === r.key ? "bg-white text-brand-700 shadow-sm ring-1 ring-brand-200" : "text-slate-500 hover:text-slate-700"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p className="mb-4 text-center text-[11px] text-slate-400">{roleInfo.hint}</p>

        <AnimatePresence mode="wait">
          <motion.form
            key={role + mode}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -14 }}
            onSubmit={submit}
          >
            {mode === "signup" && (
              <>
                <label className="label">Your name <span className="text-danger-600">*</span></label>
                <input className="input" placeholder="e.g. Aarav Patel" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </>
            )}

            {role !== "ADMIN" && role !== "DRIVER" && (
              <>
                <label className="label mt-3">Mobile number <span className="text-danger-600">*</span></label>
                <div className="input flex items-center gap-2">
                  <span className="border-r border-slate-200 pr-2 text-sm font-semibold text-slate-500">+91</span>
                  <input
                    className="w-full bg-transparent text-sm outline-none"
                    placeholder="10-digit mobile"
                    value={mobile}
                    maxLength={10}
                    inputMode="numeric"
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </>
            )}

            {role === "DRIVER" && (
              <>
                <label className="label">Conductor ID <span className="text-danger-600">*</span></label>
                <input
                  className="input font-mono tracking-wider"
                  placeholder="GJ015500"
                  value={conductorId}
                  onChange={(e) => setConductorId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  autoFocus
                />
                <p className="mt-1 text-[11px] text-slate-400">Conductor ID admin se milti hai</p>
              </>
            )}

            {(role === "PASSENGER" || role === "ADMIN") && (
              <>
                <label className="label mt-3">Email <span className="text-danger-600">*</span></label>
                <input
                  className="input"
                  type="email"
                  placeholder={role === "ADMIN" ? "admin email" : "you@email.com"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                />
              </>
            )}

            <label className="label mt-3">Password <span className="text-danger-600">*</span></label>
            <input
              className="input"
              type="password"
              placeholder={mode === "signup" ? "Kam se kam 6 characters" : "••••••••"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />

            {error && <p className="mt-2 rounded-lg bg-danger-50 px-3 py-2 text-xs font-medium text-danger-600">{error}</p>}

            <button className="btn-primary mt-4 w-full" disabled={busy || !canSubmit}>
              {busy ? "Checking…" : mode === "signup" ? "Create account →" : "Login →"}
            </button>
          </motion.form>
        </AnimatePresence>

        {role === "PASSENGER" && (
          <p className="mt-4 text-center text-sm text-slate-500">
            {mode === "login" ? (
              <>Naye ho?{" "}
                <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => { setMode("signup"); setError(""); }}>
                  Account banao
                </button>
              </>
            ) : (
              <>Pehle se account hai?{" "}
                <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => { setMode("login"); setError(""); }}>
                  Login karo
                </button>
              </>
            )}
          </p>
        )}

        <p className="mt-5 flex items-center justify-center gap-1.5 border-t border-slate-100 pt-4 text-[11px] text-slate-400">
          🔒 Aapki details encrypted (hashed) rehti hain — koi auto-fill nahi, sirf aap khud type karo
        </p>
      </motion.div>

      <p className="mt-4 max-w-xs text-center text-xs text-slate-400">
        By continuing you agree to Gujarat Bus Seva's Terms of Use & Privacy Policy.
      </p>
    </Page>
  );
}
