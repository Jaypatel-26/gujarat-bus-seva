import { Router } from "express";
import { prisma } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { wrap, badRequest } from "../lib/util.js";

const r = Router();

// GET /api/reviews?routeId= | ?tripId=
r.get("/", wrap(async (req, res) => {
  const where = {};
  if (req.query.routeId) where.route_id = Number(req.query.routeId);
  if (req.query.tripId) where.trip_id = Number(req.query.tripId);
  const [reviews, agg] = await Promise.all([
    prisma.review.findMany({
      where, include: { user: { select: { name: true } } },
      orderBy: { created_at: "desc" }, take: 30,
    }),
    prisma.review.aggregate({ where, _avg: { rating: true }, _count: true }),
  ]);
  res.json({ reviews, rating: { avg: +(agg._avg.rating || 0).toFixed(1), count: agg._count } });
}));

// POST /api/reviews { tripId, routeId?, rating, comment }
r.post("/", authRequired(), wrap(async (req, res) => {
  const { tripId, comment } = req.body || {};
  let { routeId } = req.body || {};
  const rating = Number(req.body.rating);
  if (!rating || rating < 1 || rating > 5) return badRequest(res, "Rating must be 1–5 stars");
  if (!routeId && tripId) {
    const t = await prisma.trip.findUnique({ where: { id: Number(tripId) }, select: { route_id: true } });
    routeId = t?.route_id;
  }
  const review = await prisma.review.create({
    data: {
      user_id: req.user.id,
      trip_id: tripId ? Number(tripId) : null,
      route_id: routeId ? Number(routeId) : null,
      rating,
      comment: String(comment || "").slice(0, 500),
    },
  });
  res.json({ ok: true, review });
}));

export default r;
