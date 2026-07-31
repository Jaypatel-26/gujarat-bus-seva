import { motion } from "framer-motion";
import { Badge, Stars } from "./ui";
import { fmtTime, minsToText, inr } from "../lib/format";
import { busTypeLabel } from "../api";

export function TripCardSkeleton() {
  return (
    <div className="card flex flex-col gap-4 p-5 md:flex-row md:items-center">
      <div className="flex-1 space-y-2">
        <div className="skeleton h-5 w-48" />
        <div className="skeleton h-3 w-32" />
      </div>
      <div className="skeleton h-10 w-64" />
      <div className="skeleton h-10 w-28" />
    </div>
  );
}

export default function TripCard({ trip, rating, onSelect, index = 0 }) {
  const full = trip.seatsLeft <= 0;
  const disabled = !trip.bookable;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3), duration: 0.28 }}
      className={`card group flex flex-col gap-4 border border-transparent p-5 transition hover:border-brand-100 hover:shadow-lift md:flex-row md:items-center ${disabled ? "opacity-70" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-display text-[15px] font-semibold text-ink">{trip.bus.operator}</h3>
          <Badge tone={trip.bus.type.includes("SLEEPER") ? "blue" : trip.bus.type.startsWith("AC") ? "green" : "slate"}>
            {busTypeLabel(trip.bus.type)}
          </Badge>
          {trip.status === "IN_PROGRESS" && <Badge tone="green">● On the way</Badge>}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
          <span>{trip.bus.number}</span>
          {rating?.count > 0 && (
            <span className="flex items-center gap-1">
              <Stars value={rating.avg} size={11} />
              <span className="font-semibold text-slate-500">{rating.avg}</span>
              <span>({rating.count})</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 md:gap-6">
        <div className="text-center">
          <p className="font-display text-lg font-bold text-ink">{fmtTime(trip.departureTime)}</p>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Departs</p>
        </div>
        <div className="flex w-28 flex-col items-center">
          <span className="text-[11px] font-semibold text-slate-400">{minsToText(trip.durationMin)}</span>
          <div className="relative my-1 h-px w-full bg-slate-200">
            <span className="absolute -left-0.5 -top-[3px] h-2 w-2 rounded-full border-2 border-brand-500 bg-white" />
            <span className="absolute -right-0.5 -top-[3px] h-2 w-2 rounded-full bg-brand-500" />
          </div>
          <span className="text-[10px] text-slate-400">direct</span>
        </div>
        <div className="text-center">
          <p className="font-display text-lg font-bold text-ink">{fmtTime(trip.arrivalTime)}</p>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Arrives</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 md:w-52 md:flex-col md:items-end md:gap-2">
        <div className="text-left md:text-right">
          <p className="font-display text-xl font-bold text-brand-600">{inr(trip.fare)}</p>
          <p className={`text-xs font-semibold ${full ? "text-danger-600" : trip.seatsLeft <= 8 ? "text-saffron-600" : "text-leaf-600"}`}>
            {full ? "Sold out" : `${trip.seatsLeft} seats left`}
          </p>
        </div>
        <button
          onClick={() => !disabled && onSelect(trip)}
          disabled={disabled}
          className={disabled ? "btn-ghost" : "btn-primary"}
        >
          {trip.departed ? "Departed" : full ? "Housefull" : "Select Seats →"}
        </button>
      </div>
    </motion.div>
  );
}
