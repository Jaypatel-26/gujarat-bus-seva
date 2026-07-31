import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, API, busTypeLabel } from "../api";
import { fmtTime, fmtDate, inr } from "../lib/format";
import { Page, Badge, Skeleton, EmptyState } from "../components/ui";
import { toast } from "../store";

let rzpLoading = null;
function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve(true);
  if (!rzpLoading) {
    rzpLoading = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });
  }
  return rzpLoading;
}

export default function Checkout() {
  const { pnr } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [paying, setPaying] = useState(false);
  const pollRef = useRef(null);

  const load = () =>
    api(`/bookings/${pnr}`).then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); return () => clearTimeout(pollRef.current); /* eslint-disable-next-line */ }, [pnr]);

  const booking = data?.booking;
  const order = data?.order;

  useEffect(() => {
    if (booking?.status === "CONFIRMED") nav(`/ticket/${pnr}`, { replace: true });
    if (booking?.status === "CANCELLED") setError("This booking was cancelled. Seats have been released.");
  }, [booking?.status, pnr, nav]);

  const confirm = async (payload) => {
    await api("/payments/confirm", { method: "POST", body: { pnr, ...payload } });
  };

  const pay = async () => {
    if (!order) return;
    setPaying(true);
    try {
      if (order.mock) {
        await new Promise((r) => setTimeout(r, 900)); // simulate gateway
        await confirm({ mock: true });
        toast.ok("Payment successful! 🎉");
        nav(`/ticket/${pnr}`, { replace: true });
        return;
      }
      const ok = await loadRazorpayScript();
      if (!ok) throw new Error("Couldn't load Razorpay. Check your internet and retry.");
      const rzp = new window.Razorpay({
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        name: "Gujarat Bus Seva",
        description: `${booking.trip.route.fromCity.name} → ${booking.trip.route.toCity.name} • ${pnr}`,
        order_id: order.id,
        theme: { color: "#0F4C81" },
        prefill: { contact: booking.contact_mobile || "", email: booking.contact_email || "" },
        handler: async (resp) => {
          try {
            await confirm({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            toast.ok("Payment successful! 🎉");
            nav(`/ticket/${pnr}`, { replace: true });
          } catch (e) { toast.err(e.message); }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.open();
    } catch (e) {
      toast.err(e.message);
      setPaying(false);
    }
  };

  const cancelBooking = async () => {
    try {
      await api(`/bookings/${pnr}/cancel`, { method: "POST" });
      toast.info("Booking cancelled, seats released.");
      nav("/bookings");
    } catch (e) { toast.err(e.message); }
  };

  if (error) return <Page className="mx-auto max-w-3xl px-4 py-8"><EmptyState icon="🧾" title="Checkout unavailable" subtitle={error} /></Page>;
  if (!booking) return <Page className="mx-auto max-w-4xl px-4 py-8"><div className="grid gap-5 md:grid-cols-2"><Skeleton className="h-72 w-full" /><Skeleton className="h-72 w-full" /></div></Page>;

  const t = booking.trip;
  const r = t.route;

  return (
    <Page className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-1 font-display text-xl font-bold md:text-2xl">Review & Pay</h1>
      <p className="mb-5 text-sm text-slate-500">PNR <b className="text-brand-600">{pnr}</b> • Seats held for 15 minutes</p>

      <div className="grid gap-5 md:grid-cols-[1.2fr,1fr]">
        <div className="card p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-display text-[15px] font-semibold">{r.fromCity.name} → {r.toCity.name}</h2>
            <Badge tone="blue">{busTypeLabel(t.bus.type)}</Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Info label="Journey date" value={fmtDate(t.date)} />
            <Info label="Departure" value={fmtTime(t.departure_time)} />
            <Info label="Operator" value={t.bus.operator_name} />
            <Info label="Bus number" value={t.bus.bus_number} />
          </div>
          <div className="mt-4">
            <p className="label">Passengers</p>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
              {booking.passengers.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                  <span className="font-medium">{p.name} <span className="text-xs text-slate-400">({p.age}{p.gender})</span></span>
                  <span className="chip bg-brand-50 text-brand-600">Seat {p.seat_number}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 space-y-1.5 border-t border-dashed border-slate-200 pt-3 text-sm">
            <p className="flex justify-between text-slate-600"><span>Base fare × {booking.passengers.length}</span><span>{inr(booking.total_fare)}</span></p>
            <p className="flex justify-between text-slate-600"><span>Convenience fee</span><span className="font-semibold text-leaf-600">FREE</span></p>
            <p className="flex justify-between border-t border-slate-100 pt-2 font-display text-lg font-bold"><span>Total</span><span className="text-brand-600">{inr(booking.total_fare)}</span></p>
          </div>
        </div>

        <div className="card h-fit p-5">
          <h2 className="font-display text-[15px] font-semibold">Payment</h2>
          {order?.mock && (
            <div className="mt-3 rounded-xl border border-saffron-400/40 bg-saffron-50 p-3 text-xs font-medium text-saffron-700">
              ⚡ <b>Demo mode</b> — Razorpay keys are not configured, so no real money moves. Clicking Pay simulates a successful UPI payment.
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {["UPI", "Cards", "NetBanking", "Wallets"].map((m) => (
              <span key={m} className="chip border border-slate-200 bg-white text-slate-500">{m}</span>
            ))}
          </div>
          <button onClick={pay} disabled={paying || !order} className="btn-primary mt-4 w-full py-3 text-base">
            {paying ? "Processing…" : `Pay ${inr(booking.total_fare)} ${order?.mock ? "(Demo)" : "Securely"} →`}
          </button>
          <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-slate-400">🔒 256-bit encrypted • powered by Razorpay</p>
          <button onClick={cancelBooking} className="mt-3 w-full text-center text-xs font-medium text-slate-400 underline-offset-2 hover:text-danger-600 hover:underline">
            Cancel & release seats
          </button>
        </div>
      </div>
    </Page>
  );
}

const Info = ({ label, value }) => (
  <div><p className="label mb-0.5">{label}</p><p className="font-semibold">{value}</p></div>
);
