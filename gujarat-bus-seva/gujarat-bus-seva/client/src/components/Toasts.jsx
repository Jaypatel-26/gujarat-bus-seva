import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "../store";

const STYLE = {
  ok: "border-leaf/30 bg-white text-leaf-700",
  err: "border-danger/30 bg-white text-danger-600",
  info: "border-brand-200 bg-white text-brand-600",
};
const ICON = { ok: "✅", err: "⚠️", info: "ℹ️" };

export default function Toasts() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[320px] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 30, scale: 0.95 }}
            className={`pointer-events-auto flex cursor-pointer items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-lift ${STYLE[t.type] || STYLE.info}`}
            onClick={() => dismiss(t.id)}
          >
            <span>{ICON[t.type] || ICON.info}</span>
            <span className="text-slate-700">{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
