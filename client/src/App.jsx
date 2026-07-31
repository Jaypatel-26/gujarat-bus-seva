import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Toasts from "./components/Toasts";
import Home from "./pages/Home";
import Results from "./pages/Results";
import Seats from "./pages/Seats";
import Checkout from "./pages/Checkout";
import Ticket from "./pages/Ticket";
import MyBookings from "./pages/MyBookings";
import Track from "./pages/Track";
import Login from "./pages/Login";
import DriverHome from "./pages/DriverHome";
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import DataManager from "./pages/admin/DataManager";
import BookingsAdmin from "./pages/admin/BookingsAdmin";
import Fleet from "./pages/admin/Fleet";
import { useAuth } from "./store";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);
  return null;
}

function Protected({ roles, children }) {
  const { token, user } = useAuth();
  const loc = useLocation();
  if (!token) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Navbar />
      <div className="flex-1">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Results />} />
            <Route path="/trip/:id" element={<Seats />} />
            <Route path="/checkout/:pnr" element={<Protected><Checkout /></Protected>} />
            <Route path="/ticket/:pnr" element={<Protected><Ticket /></Protected>} />
            <Route path="/bookings" element={<Protected><MyBookings /></Protected>} />
            <Route path="/track/:tripId" element={<Track />} />
            <Route path="/login" element={<Login />} />
            <Route path="/driver" element={<Protected roles={["DRIVER", "ADMIN"]}><DriverHome /></Protected>} />
            <Route path="/admin" element={<Protected roles={["ADMIN"]}><AdminLayout /></Protected>}>
              <Route index element={<Dashboard />} />
              <Route path="data" element={<DataManager />} />
              <Route path="bookings" element={<BookingsAdmin />} />
              <Route path="fleet" element={<Fleet />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </div>
      <Footer />
      <Toasts />
    </div>
  );
}
