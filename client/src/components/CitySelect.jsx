import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin } from "lucide-react";
import { loadCities } from "../api";

const POPULAR = ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Gandhinagar", "Bhuj"];

export default function CitySelect({ label, value, onChange, excludeId, placeholder = "Select city" }) {
  const [cities, setCities] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => { loadCities().then(setCities); }, []);
  useEffect(() => {
    const close = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let base = cities.filter((c) => c.id !== excludeId);
    if (needle) return base.filter((c) => c.name.toLowerCase().includes(needle));
    const pop = POPULAR.map((n) => base.find((c) => c.name === n)).filter(Boolean);
    const rest = base.filter((c) => !POPULAR.includes(c.name));
    return [...pop, ...rest]; // saari cities — scroll se sab dikhengi
  }, [cities, q, excludeId]);

  const choose = (city) => { onChange(city); setQ(""); setOpen(false); };

  return (
    <div className="relative" ref={boxRef}>
      {label && <label className="label">{label}</label>}
      <div className={`input flex cursor-text items-center gap-2 ${open ? "border-brand-500 ring-4 ring-brand-100" : ""}`}
        onClick={() => { setOpen(true); if (!cities.length) loadCities().then(setCities); }}>
        <MapPin size={16} className={value ? "text-saffron-600" : "text-slate-400"} />
        <input
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          placeholder={value ? value.name : placeholder}
          value={open ? q : value ? value.name : q}
          onFocus={() => { setOpen(true); if (!cities.length) loadCities().then(setCities); }}
          onChange={(e) => { setQ(e.target.value); setOpen(true); if (value) onChange(null); }}
        />
        {value && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange(null); setQ(""); }}
            className="rounded-md p-0.5 text-slate-300 hover:bg-slate-100 hover:text-slate-500">✕</button>
        )}
      </div>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 2 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-100 bg-white p-1.5 shadow-lift"
          >
            {!q && <li className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Popular cities • neeche sab hain, ya type karo</li>}
            {list.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => choose(c)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-brand-50"
                >
                  <MapPin size={14} className="text-slate-300" />
                  <span className="font-medium text-slate-700">{c.name}</span>
                  <span className="ml-auto text-[11px] text-slate-400">{c.state}</span>
                </button>
              </li>
            ))}
            {!list.length && <li className="px-3 py-4 text-center text-sm text-slate-400">No city matches “{q}”</li>}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
