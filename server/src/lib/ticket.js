import PDFDocument from "pdfkit";
import QRCode from "qrcode";

export async function qrDataUrl(payloadObj) {
  return QRCode.toDataURL(JSON.stringify(payloadObj), { width: 220, margin: 1 });
}

const BLUE = "#0F4C81", SAFFRON = "#F4A100", INK = "#1C1C1E", GREY = "#6B7280";

const fmtTime = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export async function streamTicketPdf(booking, res) {
  const trip = booking.trip;
  const route = trip.route;
  const qrPayload = {
    pnr: booking.pnr,
    route: `${route.fromCity.name} → ${route.toCity.name}`,
    date: fmtDate(trip.date),
    seats: booking.passengers.map((p) => p.seat_number || "").filter(Boolean).join(","),
    pax: booking.passengers.length,
  };
  const qrPng = await QRCode.toBuffer(JSON.stringify(qrPayload), { width: 150, margin: 1 });

  const doc = new PDFDocument({ size: "A4", margin: 48 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="GBS-${booking.pnr}.pdf"`);
  doc.pipe(res);

  // Header band
  doc.roundedRect(0, 0, 612, 96, 0).fill(BLUE);
  doc.fill("#FFFFFF").font("Helvetica-Bold").fontSize(22).text("Gujarat Bus Seva", 48, 30);
  doc.fontSize(10).font("Helvetica").fillColor("#FFD98A")
    .text("Gujarat ki har city, ek hi booking se", 48, 58);
  doc.fillColor("#FFFFFF").fontSize(12).font("Helvetica-Bold")
    .text(`PNR: ${booking.pnr}`, 400, 36, { align: "right", width: 164 });
  doc.font("Helvetica").fontSize(9).text(`Booked on ${fmtDate(booking.created_at)}`, 400, 54, { align: "right", width: 164 });

  let y = 122;
  doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(15)
    .text(`${route.fromCity.name}  →  ${route.toCity.name}`, 48, y);
  y += 24;

  const row = (label, value, x = 48, w = 250) => {
    doc.font("Helvetica").fontSize(9).fillColor(GREY).text(label.toUpperCase(), x, y);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(value, x, y + 12, { width: w });
  };

  row("Date of Journey", fmtDate(trip.date));
  row("Departure", fmtTime(trip.departure_time), 330);
  y += 44;
  row("Bus / Operator", `${trip.bus.operator_name}`);
  row("Bus Type", trip.bus.type.replace(/_/g, "-"), 330);
  y += 44;
  row("Reporting Time", fmtTime(new Date(new Date(trip.departure_time) - 15 * 60000)));
  row("Status", booking.status, 330);
  y += 52;

  // Passenger table
  doc.font("Helvetica-Bold").fontSize(12).fillColor(BLUE).text("Passengers", 48, y);
  y += 18;
  doc.moveTo(48, y).lineTo(564, y).lineWidth(0.6).strokeColor("#E5E7EB").stroke();
  y += 8;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(GREY);
  doc.text("NAME", 48, y).text("AGE", 260, y).text("GENDER", 320, y).text("SEAT", 400, y).text("FARE", 480, y);
  y += 16;
  doc.font("Helvetica").fontSize(10).fillColor(INK);
  for (const p of booking.passengers) {
    doc.text(p.name, 48, y, { width: 200 })
      .text(String(p.age), 260, y)
      .text(p.gender, 320, y)
      .text(p.seat_number || "-", 400, y)
      .text(`₹${Math.round(booking.total_fare / booking.passengers.length)}`, 480, y);
    y += 18;
  }
  y += 8;
  doc.moveTo(48, y).lineTo(564, y).lineWidth(0.6).strokeColor("#E5E7EB").stroke();
  y += 10;
  doc.font("Helvetica-Bold").fontSize(12).fillColor(BLUE)
    .text(`Total Fare: ₹${booking.total_fare}`, 400, y, { align: "right", width: 164 });

  // QR block
  doc.image(qrPng, 48, y - 6, { width: 110 });
  doc.font("Helvetica").fontSize(8).fillColor(GREY)
    .text("Scan at boarding for verification", 40, y + 108, { width: 130, align: "center" });

  // Footer
  doc.roundedRect(48, 720, 516, 46, 8).fill("#FFF7E8");
  doc.fillColor(BLUE).fontSize(8.5).font("Helvetica")
    .text("Carry a valid Govt. photo ID. Cancellation as per operator policy. Need help? support@gujaratbusseva.in • Helpline 1800-419-0001", 60, 734, { width: 492, align: "center" });
  doc.fillColor(SAFFRON).fontSize(9).text("🚌 Have a safe journey!", 48, 790, { width: 516, align: "center" });

  doc.end();
}
