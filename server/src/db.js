import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

// Simple in-memory city cache (cities are static, 41 rows).
let cityCache = null;
export async function getCities() {
  if (!cityCache) cityCache = await prisma.city.findMany({ orderBy: { name: "asc" } });
  return cityCache;
}
export function bustCityCache() { cityCache = null; }

// Popular routes ka cache (homepage pe sabse pehle load hota hai — instant rakhna hai)
let popularCache = null; // { data, ts }
export function getPopularCache(ttlMs) {
  return popularCache && Date.now() - popularCache.ts < ttlMs ? popularCache.data : null;
}
export function setPopularCache(data) { popularCache = { data, ts: Date.now() }; }
export function bustPopularCache() { popularCache = null; }
