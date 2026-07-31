import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api";
import { Page } from "../components/ui";
import { toast, useAuth } from "../store";

const DEMO = [
  { label: "👤 Passenger", id: "9876543210", pw: "demo123" },
  { label: "🛠️ Admin", id: "9000000001", pw: "admin123" },
  { label: "🚍 Driver", id: "9000000002", pw: "driver123" },
];

export default function Login() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { setAuth } = useAuth();

  const [tab, setTab] = useState("password"); // password | otp
  const [mode, setMode] = useState("login"); // login | signup (password tab)
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");

  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [devOtp, setDevOtp] = useState(null);
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

  const requestOtp = async (e) => {
    e?.preventDefault();
    setBusy(true); setError("");
    try {
      const d = await api("/auth/otp/request", { method: "POST", body: { mobile } });
      setIsNew(d.isNewUser);
      if (d.devOtp) { setDevOtp(d.devOtp); setOtp(d.devOtp); }
      setStep(2);
      toast.ok(d.smsSent ? "OTP sent via SMS 📲" : "OTP ready ✅");
    } catch (e2) { setError(e2.message); }
    setBusy(false);
  };

  const verify = async (e) => {
    e?.preventDefault();
    setBusy(true); setError("");
    try {
      const d = await api("/auth/otp/verify", { method: "POST", body: { mobile, otp, name } });
      afterAuth(d);
    } catch (e2) { setError(e2.message); }
    setBusy(false);
  };

  const switchTab = (t) => { setTab(t); setError(""); };

  return (
    <Page className="mx-auto flex max-w-md flex-col items-center px-4 py-10">
      <motion.div layout className="card w-full p-6">
        <div className="mb-4 text-center">
          <span className="text-4xl">🚌</span>
          <h1 className="mt-2 font-display text-xl font-bold">Login / Signup</h1>
          <p className="text-sm text-slate-500">Apna account — password ya OTP se</p>
        </div>

        {/* Tabs */}
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => switchTab("password")}
            className={`rounded-lg py-2 transition ${tab === "password" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            🔑 Password
          </button>
          <button
            type="button"
            onClick={() => switchTab("otp")}
            className={`rounded-lg py-2 transition ${tab === "otp" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            📲 OTP
          </button>
        </div>

        <AnimatePresence mode="wait">
          {tab === "password" ? (
            <motion.div key="pw" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14 }}>
              <form onSubmit={mode === "login" ? passwordLogin : signup}>
                {mode === "signup" && (
                  <>
                    <label className="label">Your name</label>
                    <input className="input" placeholder="e.g. Aarav Patel" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                    <label className="label mt-3">Mobile number</label>
                  </>
                )}
                {mode === "login" && <label className="label">Mobile number ya email</label>}
                <input
                  className="input"
                  placeholder={mode === "login" ? "98765 43210 ya you@email.com" : "98765 43210"}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoFocus={mode === "login"}
                />
                {mode === "signup" && (
                  <>
                    <label className="label mt-3">Email <span className="font-normal text-slate-400">(optional)</span></label>
                    <input className="input" type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </>
                )}
                <label className="label mt-3">Password</label>
                <input
                  className="input"
                  type="password"
                  placeholder={mode === "signup" ? "Kam se kam 6 characters" : "••••••••"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {error && <p className="mt-2 text-xs font-medium text-danger-600">{error}</p>}
                <button
                  className="btn-primary mt-4 w-full"
                  disabled={busy || !identifier.trim() || password.length < 1 || (mode === "signup" && (!name.trim() || identifier.replace(/\D/g, "").length < 10 || password.length < 6))}
                >
                  {busy ? "Please wait…" : mode === "login" ? "Login →" : "Create account →"}
                </button>
              </form>

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
                  <div className="flex justify-center gap-2">
                    {DEMO.map((d) => (
                      <button key={d.id} type="button"
                        onClick={() => { setIdentifier(d.id); setPassword(d.pw); setError(""); }}
                        className={`chip border transition ${identifier === d.id ? "border-saffron bg-saffron-50 text-saffron-700" : "border-slate-200 bg-white text-slate-500 hover:border-brand-200"}`}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-center text-[11px] text-slate-400">
                    Chip dabate hi mobile + password auto-fill ho jayega
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="otp" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }}>
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.form key="s1" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14 }} onSubmit={requestOtp}>
                    <label className="label">Mobile number</label>
                    <div className="input flex items-center gap-2">
                      <span className="border-r border-slate-200 pr-2 text-sm font-semibold text-slate-500">+91</span>
                      <input
                        className="w-full bg-transparent text-sm outline-none"
                        placeholder="98765 43210"
                        value={mobile}
                        maxLength={10}
                        inputMode="numeric"
                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                        autoFocus
                      />
                    </div>
                    {error && <p className="mt-2 text-xs font-medium text-danger-600">{error}</p>}
                    <button className="btn-primary mt-4 w-full" disabled={busy || mobile.length !== 10}>
                      {busy ? "Sending OTP…" : "Send OTP →"}
                    </button>
                  </motion.form>
                ) : (
                  <motion.form key="s2" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} onSubmit={verify}>
                    <p className="text-sm text-slate-600">
                      OTP sent to <b>+91 {mobile}</b>{" "}
                      <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => { setStep(1); setError(""); }}>change</button>
                    </p>
                    {devOtp && (
                      <p className="mt-2 rounded-lg bg-saffron-50 px-3 py-2 text-xs font-semibold text-saffron-700">
                        🔧 Demo mode: your OTP is <b>{devOtp}</b> (auto-filled). Jab SMS service lagegi, ye mobile par SMS se aayega.
                      </p>
                    )}
                    <label className="label mt-4">Enter OTP</label>
                    <input
                      className="input text-center font-display text-xl tracking-[0.5em]"
                      placeholder="••••••"
                      maxLength={6}
                      value={otp}
                      inputMode="numeric"
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      autoFocus
                    />
                    {isNew && (
                      <>
                        <label className="label mt-4">Your name</label>
                        <input className="input" placeholder="e.g. Aarav Patel" value={name} onChange={(e) => setName(e.target.value)} />
                      </>
                    )}
                    {error && <p className="mt-2 text-xs font-medium text-danger-600">{error}</p>}
                    <button className="btn-primary mt-4 w-full" disabled={busy || otp.length !== 6 || (isNew && !name.trim())}>
                      {busy ? "Verifying…" : "Verify & Login →"}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <p className="mt-4 max-w-xs text-center text-xs text-slate-400">
        By continuing you agree to Gujarat Bus Seva's Terms of Use & Privacy Policy.
      </p>
    </Page>
  );
}
