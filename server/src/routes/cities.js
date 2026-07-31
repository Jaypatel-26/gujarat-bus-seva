import { Router } from "express";
import { getCities } from "../db.js";
import { wrap } from "../lib/util.js";

const r = Router();

// GET /api/cities?q=sur
r.get("/", wrap(async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  let cities = await getCities();
  if (q) cities = cities.filter((c) => c.name.toLowerCase().includes(q));
  res.json({ cities: cities.slice(0, 50) });
}));

export default r;
