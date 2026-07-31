import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../lib/util.js";

export function authRequired(...roles) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : req.query.token;
    if (!token) return res.status(401).json({ error: "Login required" });
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You don't have access to this resource" });
    }
    next();
  };
}
