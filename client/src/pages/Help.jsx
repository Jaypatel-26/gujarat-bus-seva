import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Phone, Mail, Clock, RefreshCcw, BadgeCheck, TicketX, Info } from "lucide-react";
import { Page } from "../components/ui";

const REFUND_ROWS = [
  { when: "Departure se 6+ ghante pehle", refund: "100% refund", note: "FREE cancellation — koi charge nahi", cls: "text-leaf-600 bg-leaf-50" },
  { when: "Departure se 6 ghante se andar", refund: "50% refund", note: "Seat late-stage pe block ho jati hai", cls: "text-saffron-600 bg-saffron-50" },
  { when: "Departure ke baad / no-show", refund: "No refund", note: "Bus depart hone ke baad refund nahi", cls: "text-danger-600 bg-danger-50" },
  { when: "Operator ne bus cancel ki", refund: "100% auto-refund", note: "Cancellation SMS/notification ke saath full refund", cls: "text-leaf-600 bg-leaf-50" },
];

const FAQS = [
  { q: "Bus ticket kaise book karu?", a: "Home page pe From-To cities aur date choose karo → Search Buses → apni bus select karo → seat chuno → passenger details bharo → payment karo. Turant QR e-ticket mil jayegi." },
  { q: "Apni bus ka pura route kaise dekhu?", a: "My Bookings me apni booking ke saamne '🗺️ Route' dabao. 3D Route Vision me pura rasta dikhta hai — kaun se station pe kitne baje bus aayegi aur kab chalegi, halt kitna hai — sab schedule ke saath." },
  { q: "Ticket cancel kaise karu?", a: "My Bookings → booking kholo → Cancel Booking. Refund rules neeche table me diye hain. Cancel karte hi refund process start ho jata hai." },
  { q: "Refund kitne din me aata hai?", a: "Refund 3-5 working days me aapke original payment method (UPI/card/bank) me aa jata hai. Demo mode me ye simulation hota hai, real payment nahi." },
  { q: "Payment fail ho gaya but paise kat gaye?", a: "Aisa hone pe amount 5-7 din me automatically bank se wapas aa jata hai. Booking confirm nahi hui to dobara try karo. Problem rahe to support pe contact karo." },
  { q: "Main conductor hoon, kaise login karu?", a: "Login page pe apni Conductor ID (jaise GJ015500) aur password dalo. ID aapko admin se milti hai. Dobara conductor ID ke liye admin se contact karo." },
];

export default function Help() {
  return (
    <Page className="mx-auto max-w-4xl px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h1 className="font-display text-3xl font-extrabold text-ink">Help & Refund Policy 🎧</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
          Booking, cancellation, refund — sab jawab ek hi jagah. Phir bhi doubt ho, helpline pe call karo.
        </p>
      </motion.div>

      {/* Contact strip */}
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Phone size={18} /></span>
          <div><p className="text-sm font-semibold">1800-419-0001</p><p className="text-xs text-slate-500">Toll-free, 24×7</p></div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Mail size={18} /></span>
          <div><p className="text-sm font-semibold">support@gujaratbusseva.in</p><p className="text-xs text-slate-500">Reply within 24h</p></div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Clock size={18} /></span>
          <div><p className="text-sm font-semibold">Refund time</p><p className="text-xs text-slate-500">3-5 working days</p></div>
        </div>
      </div>

      {/* Refund Policy */}
      <div className="card mt-8 overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><RefreshCcw size={18} className="text-brand-600" /> Cancellation & Refund Policy</h2>
          <p className="mt-1 text-xs text-slate-500">Cancel karne ka time decide karta hai kitna refund milega:</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Cancel kab kiya</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Refund</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Note</th>
              </tr>
            </thead>
            <tbody>
              {REFUND_ROWS.map((r) => (
                <tr key={r.when} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3.5 font-medium">{r.when}</td>
                  <td className="px-5 py-3.5"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${r.cls}`}>{r.refund}</span></td>
                  <td className="px-5 py-3.5 text-slate-500">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-5 py-3.5 text-xs leading-relaxed text-slate-500">
          <p className="flex gap-1.5"><Info size={14} className="mt-0.5 shrink-0 text-brand-500" /> Refund hamesha original payment method me jata hai. Partial cancellation (kuch passengers) allowed hai — refund unhi passengers ka hoga.</p>
          <p className="mt-1.5 flex gap-1.5"><TicketX size={14} className="mt-0.5 shrink-0 text-brand-500" /> Cancel ki hui seat dobara activate nahi hoti. Galati se cancel ho gaya to nayi booking karni hogi.</p>
          <p className="mt-1.5 flex gap-1.5"><BadgeCheck size={14} className="mt-0.5 shrink-0 text-brand-500" /> Ye demo project hai — payments test mode me hain, koi asli paisa nahi lagta.</p>
        </div>
      </div>

      {/* FAQs */}
      <h2 className="mt-10 text-center font-display text-xl font-bold text-ink">Aksar poochhe jaane wale sawaal ❓</h2>
      <div className="mt-4 space-y-2.5">
        {FAQS.map((f) => (
          <details key={f.q} className="card group px-5 py-4 open:shadow-card">
            <summary className="cursor-pointer list-none text-sm font-semibold text-ink transition group-open:text-brand-600">
              <span className="mr-2 text-saffron-500">Q.</span>{f.q}
              <span className="float-right text-slate-300 transition group-open:rotate-45 group-open:text-brand-500">＋</span>
            </summary>
            <p className="mt-2.5 border-t border-slate-100 pt-2.5 text-[13px] leading-relaxed text-slate-600">{f.a}</p>
          </details>
        ))}
      </div>

      <div className="card mt-8 flex flex-col items-center gap-2 bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-center text-white">
        <p className="font-display text-lg font-bold">Ab bhi confusion? Seedha baat karo 📞</p>
        <p className="text-sm text-white/80">Helpline: 1800-419-0001 · support@gujaratbusseva.in</p>
        <Link to="/" className="mt-2 rounded-xl bg-saffron-500 px-5 py-2 text-sm font-semibold transition hover:bg-saffron-600">Book your bus 🚌</Link>
      </div>
    </Page>
  );
}
