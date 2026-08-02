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

const BLUE2 = "#0F4C81";
const GREY2 = "#64748B";

// Conductor ka passenger manifest PDF — ek page table format
export function streamManifestPdf({ trip, conductor, rows, res }) {
  const route = trip.route;
  const doc = new PDFDocument({ size: "A4", margin: 46 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="GBS-manifest-${route.fromCity.name}-${route.toCity.name}.pdf"`);
  doc.pipe(res);

  const COLX = [46, 96, 248, 305, 397, 489]; // #, Seat, Name, Age/G, PNR, Onboard col starts
  const tableHead = (y0) => {
    doc.rect(46, y0, 516, 20).fill("#EAF2FB");
    doc.fillColor(BLUE2).font("Helvetica-Bold").fontSize(8.5);
    doc.text("SEAT", 50, y0 + 6, { width: 44 });
    doc.text("PASSENGER", COLX[1], y0 + 6, { width: 148 });
    doc.text("AGE/G", COLX[2], y0 + 6, { width: 55 });
    doc.text("PNR / MOBILE", COLX[3], y0 + 6, { width: 140 });
    doc.text("STATUS", COLX[5], y0 + 6, { width: 70, align: "right" });
  };

  // header band
  doc.rect(0, 0, doc.page.width, 84).fill(BLUE2);
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(18).text("GUJARAT BUS SEVA", 46, 24);
  doc.font("Helvetica").fontSize(9).fillColor("#CFE3F7").text("PASSENGER MANIFEST — conductor copy", 46, 47);

  let y = 106;
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#0F172A")
    .text(`${route.fromCity.name}  →  ${route.toCity.name}`, 46, y);
  y += 22;
  doc.font("Helvetica").fontSize(9.5).fillColor(GREY2)
    .text(`Date: ${fmtDate(trip.date)}    Departure: ${fmtTime(trip.departure_time)}    Arrival: ${fmtTime(trip.arrival_time)}`, 46, y);
  y += 14;
  doc.text(`Bus: ${trip.bus.bus_number} (${trip.bus.operator_name})    Conductor: ${conductor?.name || "—"}${conductor?.conductor_id ? ` [${conductor.conductor_id}]` : ""}`, 46, y);
  y += 14;
  const onboard = rows.filter((r) => r.checked).length;
  doc.font("Helvetica-Bold").fillColor("#15803D").text(`Passengers: ${rows.length}    Onboard (scanned): ${onboard}    Remaining: ${rows.length - onboard}`, 46, y);
  y += 22;

  tableHead(y);
  y += 24;
  doc.font("Helvetica").fontSize(9);

  if (!rows.length) {
    doc.fillColor(GREY2).text("Koi confirmed passenger nahi hai is trip pe.", 46, y + 6, { align: "center", width: 516 });
  }

  rows.forEach((r, i) => {
    if (y > 756) { doc.addPage(); y = 60; tableHead(y); y += 24; doc.font("Helvetica").fontSize(9); }
    if (i % 2 === 0) doc.rect(46, y - 4, 516, 20).fill(r.checked ? "#EDFAF3" : "#F8FAFC");
    doc.fillColor(r.checked ? "#15803D" : "#0F172A");
    doc.text(r.seat, 50, y, { width: 44 });
    doc.text(r.name, COLX[1], y, { width: 148 });
    doc.text(`${r.age}/${r.gender}`, COLX[2], y, { width: 55 });
    doc.fontSize(8).text(`${r.pnr}  •  ${r.contact}`, COLX[3], y, { width: 140 });
    doc.font("Helvetica-Bold").fontSize(9).fillColor(r.checked ? "#15803D" : "#94A3B8")
      .text(r.checked ? "✓ ONBOARD" : "—", COLX[5] - 3, y, { width: 76, align: "right" });
    doc.font("Helvetica").fontSize(9);
    y += 20;
    doc.moveTo(46, y - 5).lineTo(562, y - 5).lineWidth(0.4).strokeColor("#E2E8F0").stroke();
  });

  if (y > 730) { doc.addPage(); y = 60; }
  doc.roundedRect(46, 744, 516, 34, 8).fill("#FFF7E8");
  doc.fillColor(BLUE2).fontSize(8).font("Helvetica")
    .text(`Generated ${new Date().toLocaleString("en-IN")} • Gujarat Bus Seva • Helpline 1800-419-0001`, 46, 756, { width: 516, align: "center" });
  doc.end();
}
