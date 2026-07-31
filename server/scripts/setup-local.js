// Generates a SQLite variant of the Prisma schema for local development
// (so you can run the whole app without installing PostgreSQL).
// Usage: npm run setup:local
import fs from "node:fs";

const src = fs.readFileSync("prisma/schema.prisma", "utf8");
const local = src
  .replace(/provider\s*=\s*"postgresql"/, 'provider = "sqlite"')
  .replace(/url\s*=\s*env\("DATABASE_URL"\)/, 'url      = "file:./dev.db"');

fs.writeFileSync("prisma/schema.local.prisma", local);
console.log("✅ Wrote prisma/schema.local.prisma (SQLite for local dev)");
