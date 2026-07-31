import { useMemo, useState } from "react";
import { motion } from "framer-motion";

function groupBy(arr, key) {
  const m = new Map();
  for (const item of arr) {
    const k = item[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return m;
}

export default function SeatMap({ seats, busType, occupied, selected, onToggle, maxSelectable = 6 }) {
  const isSleeper = busType === "AC_SLEEPER";
  const decks = useMemo(() => [...new Set(seats.map((s) => s.deck))], [seats]);
  const [deck, setDeck] = useState("LOWER");

  const rows = useMemo(() => {
    const deckSeats = seats.filter((s) => s.deck === deck);
    const grouped = [...groupBy(deckSeats, "row").entries()].sort((a, b) => a[0] - b[0]);
    const splitAt = isSleeper ? 1 : 2;
    return grouped.map(([rowNo, rowSeats]) => ({
      rowNo,
      left: rowSeats.filter((s) => s.col < splitAt),
      right: rowSeats.filter((s) => s.col >= splitAt),
    }));
  }, [seats, deck, isSleeper]);

  const seatBtn = (s) => {
    const isTaken = occupied.has(s.id);
    const isSel = selected.has(s.id);
    const berthCls = s.seat_type === "BERTH" ? "h-[52px]" : "h-10";
    return (
      <motion.button
        key={s.id}
        type="button"
        whileTap={{ scale: 0.92 }}
        disabled={isTaken}
        onClick={() => onToggle(s, maxSelectable)}
        title={`${s.seat_number}${isTaken ? " — booked" : ""}`}
        className={`flex w-10 ${berthCls} items-center justify-center rounded-lg border text-[10px] font-bold transition
          ${isTaken ? "cursor-not-allowed border-transparent bg-slate-200 text-slate-400"
            : isSel ? "border-leaf bg-leaf text-white shadow-card"
            : "border-slate-300 bg-white text-slate-600 hover:border-saffron hover:text-saffron-700"}`}
      >
        {s.seat_number}
      </motion.button>
    );
  };

  return (
    <div>
      {decks.length > 1 && (
        <div className="mb-4 flex gap-2">
          {decks.map((d) => (
            <button key={d} type="button" onClick={() => setDeck(d)}
              className={`chip px-4 py-1.5 transition ${deck === d ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
              {d === "LOWER" ? "⬇ Lower Deck" : "⬆ Upper Deck"}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-xl border-2 border-slate-200 bg-mist/50 p-4">
        <div className="mb-3 flex justify-end">
          <span className="text-xl" title="Driver">🛞</span>
        </div>
        <div className="flex flex-col gap-2.5">
          {rows.map(({ rowNo, left, right }) => (
            <div key={rowNo} className="flex items-center justify-between gap-6">
              <div className="flex gap-2">{left.map(seatBtn)}</div>
              <div className="flex gap-2">{right.map(seatBtn)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><i className="inline-block h-3.5 w-3.5 rounded border border-slate-300 bg-white" /> Available</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-3.5 w-3.5 rounded bg-leaf" /> Selected</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-3.5 w-3.5 rounded bg-slate-200" /> Booked</span>
        <span className="ml-auto font-medium text-brand-600">Select up to {maxSelectable} seats</span>
      </div>
    </div>
  );
}
