// Razorpay integration — if keys are missing the app runs in DEMO payment mode.
let cached = null;

export function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

async function getClient() {
  if (!cached) {
    const { default: Razorpay } = await import("razorpay");
    cached = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return cached;
}

// Returns an order descriptor for the client, or a mock order in demo mode.
export async function razorpayOrder(booking) {
  if (!razorpayConfigured()) {
    return { id: `order_mock_${booking.pnr}`, key: "mock", amount: Math.round(booking.total_fare * 100), currency: "INR", mock: true };
  }
  const rp = await getClient();
  const o = await rp.orders.create({
    amount: Math.round(booking.total_fare * 100),
    currency: "INR",
    receipt: booking.pnr,
  });
  return { id: o.id, key: process.env.RAZORPAY_KEY_ID, amount: o.amount, currency: o.currency, mock: false };
}
