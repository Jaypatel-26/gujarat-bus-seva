import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api";
import { Page } from "../components/ui";
import { toast, useAuth } from "../store";

const DEMO = [
  { label: "👤 Passenger", id: "9876543210", pw: "demo123" },
  { label: "🛠️ Admin", id: "admin@gmail.com", pw: "admin123" },
  { label: "🎫 Conductor", id: "GJ015500", pw: "conductor123" },
];

export default function Login() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { setAuth } = useAuth();

  const [mode, setMode] = useState("login"); // login | signup
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
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

  const passwordLogin = async (e) => {
    e?.preventDefault();
    setBusy(true); setError("");
    try {
      const d = await api("/auth/login", { method: "POST", body: { identifier, password } });
      afterAuth(d);
    } catch (e2) { setError(e2.message); }
    setBusy(false);
  };

  const signup = async (e) => {
    e?.preventDefault();
    setBusy(true); setError("");
    try {
      const d = await api("/auth/signup", { method: "POST", body: { name, mobile: identifier, email, password } });
      afterAuth(d);
    } catch (e2) { setError(e2.message); }
    setBusy(false);
  };

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());
  const mobileDigits = identifier.replace(/\D/g, "");
  const canLogin = identifier.trim().length > 0 && password.length > 0;
  const canSignup = name.trim().length > 0 && mobileDigits.length === 10 && validEmail && password.length >= 6;

  return (
    <Page className="mx-auto flex max-w-md flex-col items-center px-4 py-10">
      <motion.div layout className="card w-full p-6">
        <div className="mb-5 text-center">
          <span className="text-4xl">🚌</span>
          <h1 className="mt-2 font-display text-xl font-bold">Login / Signup</h1>
          <p className="text-sm text-slate-500">Mobile, email ya Conductor ID + password</p>
        </div>

        <AnimatePresence mode="wait">
          <motion.form
            key={mode}
            initial={{ opacity: 0, x: mode === "login" ? -14 : 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: mode === "login" ? 14 : -14 }}
            onSubmit={mode === "login" ? passwordLogin : signup}
          >
            {mode === "signup" && (
              <>
                <label className="label">Your name <span className="text-danger-500">*</span></label>
                <input className="input" placeholder="e.g. Aarav Patel" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                <label className="label mt-3">Mobile number <span className="text-danger-500">*</span></label>
              </>
            )}
            {mode === "login" && <label className="label">Mobile number, email ya Conductor ID</label>}
            <input
              className="input"
              placeholder={mode === "login" ? "9876543210 · admin@gmail.com · GJ015500" : "98765 43210"}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoFocus={mode === "login"}
            />
            {mode === "signup" && (
              <>
                <label className="label mt-3">Email <span className="text-danger-500">*</span></label>
                <input className="input" type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </>
            )}
            <label className="label mt-3">Password <span className="text-danger-500">{mode === "signup" ? "*" : ""}</span></label>
            <input
              className="input"
              type="password"
              placeholder={mode === "signup" ? "Kam se kam 6 characters" : "••••••••"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="mt-2 text-xs font-medium text-danger-600">{error}</p>}
            <button className="btn-primary mt-4 w-full" disabled={busy || (mode === "login" ? !canLogin : !canSignup)}>
              {busy ? "Please wait…" : mode === "login" ? "Login →" : "Create account →"}
            </button>
          </motion.form>
        </AnimatePresence>

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

        {mode === "login" && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="label text-center">Quick demo logins</p>
            <div className="flex flex-wrap justify-center gap-2">
              {DEMO.map((d) => (
                <button key={d.id} type="button"
                  onClick={() => { setIdentifier(d.id); setPassword(d.pw); setError(""); }}
                  className={`chip border transition ${identifier === d.id ? "border-saffron bg-saffron-50 text-saffron-700" : "border-slate-200 bg-white text-slate-500 hover:border-brand-200"}`}>
                  {d.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              Chip dabate hi ID + password auto-fill ho jayega
            </p>
          </div>
        )}
      </motion.div>

      <p className="mt-4 max-w-xs text-center text-xs text-slate-400">
        By continuing you agree to Gujarat Bus Seva's Terms of Use & Privacy Policy.
      </p>
    </Page>
  );
}
