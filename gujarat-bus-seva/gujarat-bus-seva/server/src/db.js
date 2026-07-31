import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

// Simple in-memory city cache (cities are static, 41 rows).
let cityCache = null;
export async function getCities() {
  if (!cityCache) cityCache = await prisma.city.findMany({ orderBy: { name: "asc" } });
  return cityCache;
}
export function bustCityCache() { cityCache = null; }
