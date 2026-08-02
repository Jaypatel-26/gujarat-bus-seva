import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { api } from "../api";
import { fmtTime } from "../lib/format";

/**
 * Conductor ka e-ticket scanner — camera se QR scan ya PNR type karke
 * passengers ko us trip pe onboard mark karta hai.
 */
export default function TicketScanner({ trip, onChanged }) {
  const elId = `scan-box-${trip.id}`;
  const qrRef = useRef(null);
  const busyRef = useRef(false);
  const [camOn, setCamOn] = useState(false);
  const [camErr, setCamErr] = useState("");
  const [manual, setManual] = useState("");
  const [result, setResult] = useState(null); // { tone: ok|dup|err, title, sub, pnr, count }
  const [stats, setStats] = useState({ boarded: 0, total: 0 });
  const [recent, setRecent] = useState([]);
  const [undoing, setUndoing] = useState(false);

  const refreshStats = () =>
    api(`/driver/${trip.id}/manifest`)
      .then((d) => setStats({ boarded: d.boarded, total: d.total }))
      .catch(() => {});

  useEffect(() => {
    refreshStats();
    const qr = new Html5Qrcode(elId);
    qrRef.current = qr;
    qr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 230, height: 230 } },
      (text) => handleCode(text),
      () => {}
    )
      .then(() => setCamOn(true))
      .catch((e) => setCamErr(typeof e === "string" ? e : e?.message || "Camera on nahi ho paya"));
    return () => {
      busyRef.current = true; // aage scan callback na chale
      qr.stop().then(() => qr.clear()).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id]);

  const handleCode = async (code) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try { qrRef.current?.pause(true); } catch {}
    try {
      const d = await api(`/driver/${trip.id}/scan`, { method: "POST", body: { code } });
      setResult({ tone: d.already ? "dup" : "ok", title: d.already ? "Pehle se scanned hai" : `${d.names.join(", ")} onboard 🎉`, sub: d.msg, pnr: d.pnr, count: d.names.length });
      refreshStats();
      onChanged?.();
    } catch (e) {
      setResult({ tone: "err", title: "Galat ticket ❌", sub: e.message });
    }
    setTimeout(() => {
      try { qrRef.current?.resume(); } catch {}
      busyRef.current = false;
    }, 1500);
  };

  // recent list update alag se (result change pe)
  const lastAdded = useRef(0);
  useEffect(() => {
    if (!result) return;
    const now = Date.now();
    if (now - lastAdded.current < 300) return;
    lastAdded.current = now;
    setRecent((r) => [{ at: now, tone: result.tone, title: result.title, sub: result.sub }, ...r].slice(0, 5));
  }, [result]);

  const undo = async () => {
    if (!result?.pnr || undoing) return;
    setUndoing(true);
    try {
      const d = await api(`/driver/${trip.id}/scan/undo`, { method: "POST", body: { code: result.pnr } });
      setResult({ tone: "dup", title: "Check-in hata diya ↩️", sub: d.msg });
      refreshStats();
      onChanged?.();
    } catch (e) { setResult({ tone: "err", title: "Undo nahi hua", sub: e.message }); }
    setUndoing(false);
  };

  const tones = {
    ok: "border-leaf-300 bg-leaf-50 text-leaf-800",
    dup: "border-saffron-300 bg-saffron-50 text-saffron-800",
    err: "border-danger-300 bg-danger-50 text-danger-700",
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-mist px-3 py-2">
        <p className="text-sm font-semibold">{trip.route.fromCity.name} → {trip.route.toCity.name} <span className="text-xs font-normal text-slate-400">• {fmtTime(trip.departure_time)}</span></p>
        <span className="chip bg-white font-bold text-leaf-700 shadow-soft">✓ {stats.boarded}/{stats.total} onboard</span>
      </div>

      {/* camera */}
      {!camErr ? (
        <div className="overflow-hidden rounded-2xl bg-black/90 shadow-lift">
          <div id={elId} className="mx-auto w-full max-w-[340px] [&_video]:!rounded-2xl" />
          <p className="py-1.5 text-center text-[11px] font-medium text-white/70">{camOn ? "📷 Ticket ka QR camera ke saamne rakho…" : "Camera khul raha hai…"}</p>
        </div>
      ) : (
        <p className="rounded-xl border border-saffron-200 bg-saffron-50 px-3 py-3 text-xs text-saffron-700">
          📷 Camera nahi chala ({camErr}). Koi baat nahi — neeche <b>PNR type</b> karke verify karo, ya phone me kholo (HTTPS hamesha chahiye).
        </p>
      )}

      {/* manual entry */}
      <div className="flex gap-2">
        <input
          className="input flex-1 font-mono uppercase"
          placeholder="PNR type karo — e.g. GBS-A1B2C3"
          value={manual}
          onChange={(e) => setManual(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && manual.trim() && handleCode(manual.trim())}
        />
        <button className="btn-brand px-4" disabled={!manual.trim()} onClick={() => handleCode(manual.trim())}>Verify</button>
      </div>

      {/* result */}
      {result && (
        <div className={`rounded-xl border-2 px-4 py-3 ${tones[result.tone]}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-[15px] font-bold">{result.title}</p>
              <p className="mt-0.5 text-xs">{result.sub}</p>
            </div>
            {(result.tone === "ok" || result.tone === "dup") && (
              <button className="shrink-0 rounded-lg bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-soft hover:bg-white" disabled={undoing} onClick={undo}>
                {undoing ? "…" : "↩ Undo"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* recent scans */}
      {recent.length > 0 && (
        <div>
          <p className="label !mb-1.5">Recent scans</p>
          <div className="space-y-1">
            {recent.map((r) => (
              <div key={r.at} className={`rounded-lg px-3 py-1.5 text-xs ${r.tone === "ok" ? "bg-leaf-50 text-leaf-700" : r.tone === "dup" ? "bg-saffron-50 text-saffron-700" : "bg-danger-50 text-danger-600"}`}>
                {r.tone === "ok" ? "✅" : r.tone === "dup" ? "⚠️" : "❌"} <b>{r.title}</b> <span className="opacity-70">{r.sub}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
