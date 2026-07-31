import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export const Spinner = ({ className = "h-5 w-5" }) => (
  <span className={`inline-block animate-spin rounded-full border-2 border-slate-300 border-t-brand-500 ${className}`} />
);

export const Skeleton = ({ className = "h-4 w-full" }) => <div className={`skeleton ${className}`} />;

export function Page({ children, className = "" }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.main>
  );
}

const TONES = {
  green: "bg-leaf-50 text-leaf-700",
  red: "bg-danger-50 text-danger-600",
  amber: "bg-saffron-50 text-saffron-700",
  slate: "bg-slate-100 text-slate-600",
  blue: "bg-brand-50 text-brand-600",
};
export const Badge = ({ tone = "slate", children, className = "" }) => (
  <span className={`chip ${TONES[tone] || TONES.slate} ${className}`}>{children}</span>
);

export function Stars({ value = 0, onChange, size = 16, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map((i) =>
        onChange ? (
          <button key={i} type="button" onClick={() => onChange(i)} className="p-0.5 transition hover:scale-110">
            <StarGlyph filled={i <= value} size={size} />
          </button>
        ) : (
          <StarGlyph key={i} filled={i <= Math.round(value)} size={size} half={!Number.isInteger(value) && i === Math.ceil(value)} />
        )
      )}
    </span>
  );
}
const StarGlyph = ({ filled, size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={filled ? "fill-saffron-500" : "fill-slate-300"}>
    <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9L12 2.6z" />
  </svg>
);

export function Modal({ open, onClose, title, children, maxW = "max-w-md" }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-brand-900/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className={`relative w-full ${maxW} card max-h-[88vh] overflow-y-auto p-5`}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function EmptyState({ icon = "🚌", title, subtitle, children }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
      <div className="text-5xl">{icon}</div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {subtitle && <p className="max-w-sm text-sm text-slate-500">{subtitle}</p>}
      {children}
    </div>
  );
}

export function LiveDot({ className = "" }) {
  return (
    <span className={`relative flex h-2.5 w-2.5 ${className}`}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-leaf opacity-70" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-leaf" />
    </span>
  );
}
