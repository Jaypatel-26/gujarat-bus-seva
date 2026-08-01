import { Link } from "react-router-dom";

const CITIES_ROW = "Ahmedabad • Surat • Vadodara • Rajkot • Bhavnagar • Jamnagar • Junagadh • Gandhinagar • Bhuj • Dwarka • Somnath • Porbandar • Mehsana • Morbi • Bharuch • Vapi + 25 more";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-[1.4fr,1fr,1fr]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700">🚌</span>
              <span className="font-display text-lg font-bold text-brand-700">Gujarat Bus Seva</span>
            </div>
            <p className="mt-3 max-w-sm text-sm text-slate-500">
              Book intercity bus tickets across every corner of Gujarat — with station-wise 3D route vision,
              instant e-tickets and hassle-free cancellations.
            </p>
            <p className="mt-4 text-xs leading-relaxed text-slate-400">{CITIES_ROW}</p>
          </div>
          <div>
            <h4 className="label">Quick Links</h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><Link className="hover:text-brand-600" to="/">Search Buses</Link></li>
              <li><Link className="hover:text-brand-600" to="/about">About Us</Link></li>
              <li><Link className="hover:text-brand-600" to="/bookings">My Bookings</Link></li>
              <li><Link className="hover:text-brand-600" to="/login">Login / Signup</Link></li>
              <li><Link className="hover:text-brand-600" to="/driver">Conductor Console</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="label">Support</h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><Link className="hover:text-brand-600" to="/help">Help & Refund Policy</Link></li>
              <li>Helpline: <span className="font-semibold text-brand-600">1800-419-0001</span></li>
              <li>support@gujaratbusseva.in</li>
              <li>Free cancellation up to 6h before departure</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-slate-100 pt-5 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Gujarat Bus Seva • Made with 💙 for Gujarat • Demo project (payments in test mode)
        </div>
      </div>
    </footer>
  );
}
