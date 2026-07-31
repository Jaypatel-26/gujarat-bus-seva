import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftRight, Search, Minus, Plus } from "lucide-react";
import CitySelect from "./CitySelect";
import { todayStr } from "../lib/format";
import { toast } from "../store";

export default function SearchBar({ compact = false, initial = {}, onSearched }) {
  const nav = useNavigate();
  const [from, setFrom] = useState(initial.from || null);
  const [to, setTo] = useState(initial.to || null);
  const [date, setDate] = useState(initial.date || todayStr());
  const [pax, setPax] = useState(initial.pax || 1);

  const swap = () => { setFrom(to); setTo(from); };

  const submit = (e) => {
    e?.preventDefault();
    if (!from || !to) return toast.err("Please choose both cities");
    if (from.id === to.id) return toast.err("From and To cannot be the same city");
    if (!date) return toast.err("Pick a journey date");
    const params = `?from=${from.id}&to=${to.id}&date=${date}&pax=${pax}`;
    nav(`/search${params}`);
    onSearched?.();
  };

  return (
    <form
      onSubmit={submit}
      className={compact
        ? "grid grid-cols-2 items-end gap-3 lg:grid-cols-[1fr,auto,1fr,150px,150px,auto]"
        : "grid gap-3 md:grid-cols-[1fr,auto,1fr] lg:grid-cols-[1fr,auto,1fr,190px,170px,auto] lg:items-end"}
    >
      <CitySelect label="From" value={from} onChange={setFrom} excludeId={to?.id} placeholder="Departure city" />
      <button
        type="button" onClick={swap} title="Swap cities"
        className="mx-auto mb-0.5 hidden h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:rotate-180 hover:border-saffron hover:text-saffron-600 md:flex"
        style={{ transitionDuration: "300ms" }}
      >
        <ArrowLeftRight size={16} />
      </button>
      <CitySelect label="To" value={to} onChange={setTo} excludeId={from?.id} placeholder="Destination city" />
      <div>
        <label className="label">Journey Date</label>
        <input type="date" className="input" min={todayStr()} max={todayStr(30)} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div>
        <label className="label">Passengers</label>
        <div className="input flex items-center justify-between px-2">
          <button type="button" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 disabled:opacity-30"
            disabled={pax <= 1} onClick={() => setPax((p) => Math.max(1, p - 1))}>
            <Minus size={15} />
          </button>
          <span className="text-sm font-bold text-brand-700">{pax}</span>
          <button type="button" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 disabled:opacity-30"
            disabled={pax >= 6} onClick={() => setPax((p) => Math.min(6, p + 1))}>
            <Plus size={15} />
          </button>
        </div>
      </div>
      <button type="submit" className="btn-primary h-[46px] px-6 md:col-span-3 lg:col-span-1">
        <Search size={17} /> Search Buses
      </button>
    </form>
  );
}
