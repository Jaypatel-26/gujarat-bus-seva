import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Bus, MapPin, Navigation, ShieldCheck, QrCode, HeartHandshake, Target, Eye, Phone, Mail } from "lucide-react";
import { Page } from "../components/ui";

const STATS = [
  { big: "41", small: "Gujarat cities covered" },
  { big: "196", small: "bus routes (both ways)" },
  { big: "700+", small: "departures daily" },
  { big: "4.6★", small: "average traveller rating" },
];

const FEATURES = [
  { icon: <Navigation size={22} />, title: "Live GPS Tracking", text: "Har bus ka live location — parivaar wale ghar baithe dekh sakte hain bus kaha pahunchi." },
  { icon: <QrCode size={22} />, title: "Instant QR e-Tickets", text: "Booking karte hi QR ticket + PDF download. Print ki zaroorat nahi — phone dikhao, chadho." },
  { icon: <ShieldCheck size={22} />, title: "Safe & Verified", text: "Verified operators, trained conductors aur secure Razorpay payments — bina tension travel karo." },
  { icon: <HeartHandshake size={22} />, title: "Easy Cancellation", text: "Plan badla? 6 ghante pehle tak free cancellation, refund seedha aapke account me." },
];

export default function About() {
  return (
    <Page className="mx-auto max-w-4xl px-4 py-10">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-3xl shadow-card">🚌</span>
        <h1 className="mt-4 font-display text-3xl font-extrabold text-ink md:text-4xl">
          Gujarat ki har city, <span className="text-saffron-500">ek hi booking se</span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-500 md:text-base">
          Gujarat Bus Seva ek mission hai — Gujarat ke 41 shehron ko ek modern, vishwasniya aur
          aasaan bus booking platform se jodna. Ahmedabad se Dwarka, Surat se Somnath —
          har safar, sirf kuch clicks door.
        </p>
      </motion.div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.small} className="card p-4 text-center">
            <p className="font-display text-2xl font-extrabold text-brand-600 md:text-3xl">{s.big}</p>
            <p className="mt-1 text-xs text-slate-500">{s.small}</p>
          </div>
        ))}
      </div>

      {/* Story */}
      <div className="card mt-8 p-6">
        <h2 className="font-display text-lg font-bold text-ink">Hamari kahani 📖</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Gujarat me intercity bus travel har din lakhon log karte hain — students, business log, parivaar.
          Lekin booking ka matlab tha: station pe line me lagna, pata na hona ki bus kab aayegi, aur cancel
          karna ho to dukaan ke chakkar. Humne socha — <b>kyun na poora system phone pe aa jaye?</b>
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Aaj Gujarat Bus Seva pe aap seat choose kar sakte ho, live map pe bus track kar sakte ho,
          QR e-ticket seedha phone pe pa sakte ho — aur zaroorat pade to ek tap me cancel bhi.
          Hamara maanna hai: <b className="text-brand-600">"Safar aasaan, booking aur bhi aasaan."</b>
        </p>
      </div>

      {/* Mission & Vision */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="card border-l-4 border-brand-500 p-5">
          <div className="flex items-center gap-2">
            <Target size={20} className="text-brand-600" />
            <h3 className="font-display font-bold">Hamara Mission</h3>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Gujarat ke har chhote se chhote sheher tak transparent aur affordable bus booking pahunchana —
            koi hidden charges nahi, koi confusion nahi.
          </p>
        </div>
        <div className="card border-l-4 border-saffron-500 p-5">
          <div className="flex items-center gap-2">
            <Eye size={20} className="text-saffron-600" />
            <h3 className="font-display font-bold">Hamari Vision</h3>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Bharat ka sabse trusted intercity bus platform banana — jaha har yatri bina jhanjhat,
            bina bheed, apni seat pakki kare.
          </p>
        </div>
      </div>

      {/* Features */}
      <h2 className="mt-10 text-center font-display text-xl font-bold text-ink">Aapko kya milta hai</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="card flex gap-3 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{f.icon}</div>
            <div>
              <h3 className="font-display text-[15px] font-semibold">{f.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{f.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Contact */}
      <div className="card mt-8 flex flex-col items-center gap-3 bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-center text-white">
        <h3 className="font-display text-lg font-bold">Sawaal hai? Hum yahin hain 🙋</h3>
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
          <span className="flex items-center gap-1.5"><Phone size={15} /> 1800-419-0001 (toll-free)</span>
          <span className="flex items-center gap-1.5"><Mail size={15} /> support@gujaratbusseva.in</span>
          <span className="flex items-center gap-1.5"><MapPin size={15} /> Ahmedabad, Gujarat</span>
        </div>
        <div className="mt-1 flex gap-3">
          <Link to="/help" className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/25">Help & Refund Policy →</Link>
          <Link to="/" className="rounded-xl bg-saffron-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-saffron-600">Book a bus 🚌</Link>
        </div>
      </div>
    </Page>
  );
}
