import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api";
import { Page } from "../components/ui";
import { toast, useAuth } from "../store";

const DEMO = [
  { label: "👤 Passenger", mobile: "9876543210" },
  { label: "🛠️ Admin", mobile: "9000000001" },
  { label: "🚍 Driver", mobile: "9000000002" },
];

export default function Login() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { setAuth } = useAuth();

  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [devOtp, setDevOtp] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const requestOtp = async (e) => {
    e?.preventDefault();
    setBusy(true); setError("");
    try {
      const d = await api("/auth/otp/request", { method: "POST", body: { mobile } });
      setIsNew(d.isNewUser);
      if (d.devOtp) { setDevOtp(d.devOtp); setOtp(d.devOtp); }
      setStep(2);
      toast.ok("OTP sent to your mobile 📲");
    } catch (e2) { setError(e2.message); }
    setBusy(false);
  };

  const verify = async (e) => {
    e?.preventDefault();
    setBusy(true); setError("");
    try {
      const d = await api("/auth/otp/verify", { method: "POST", body: { mobile, otp, name } });
      setAuth(d.token, d.user);
      toast.ok(`Welcome, ${d.user.name || "traveller"}! 👋`);
      const next = params.get("next");
      if (next) nav(next);
      else if (d.user.role === "ADMIN") nav("/admin");
      else if (d.user.role === "DRIVER") nav("/driver");
      else nav("/");
    } catch (e2) { setError(e2.message); }
    setBusy(false);
  };

  return (
    <Page className="mx-auto flex max-w-md flex-col items-center px-4 py-10">
      <motion.div layout className="card w-full p-6">
        <div className="mb-5 text-center">
          <span className="text-4xl">🚌</span>
          <h1 className="mt-2 font-display text-xl font-bold">Login / Signup</h1>
          <p className="text-sm text-slate-500">OTP on your mobile — no passwords needed</p>
        </div>

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
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="label text-center">Quick demo logins</p>
                <div className="flex justify-center gap-2">
                  {DEMO.map((d) => (
                    <button key={d.mobile} type="button" onClick={() => setMobile(d.mobile)}
                      className={`chip border transition ${mobile === d.mobile ? "border-saffron bg-saffron-50 text-saffron-700" : "border-slate-200 bg-white text-slate-500 hover:border-brand-200"}`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.form>
          ) : (
            <motion.form key="s2" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} onSubmit={verify}>
              <p className="text-sm text-slate-600">
                OTP sent to <b>+91 {mobile}</b>{" "}
                <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => { setStep(1); setError(""); }}>change</button>
              </p>
              {devOtp && (
                <p className="mt-2 rounded-lg bg-saffron-50 px-3 py-2 text-xs font-semibold text-saffron-700">
                  🔧 Dev mode: your OTP is <b>{devOtp}</b> (auto-filled). In production this arrives via SMS.
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

      <p className="mt-4 max-w-xs text-center text-xs text-slate-400">
        By continuing you agree to Gujarat Bus Seva's Terms of Use & Privacy Policy.
      </p>
    </Page>
  );
}
