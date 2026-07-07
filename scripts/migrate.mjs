// Apply schema + modules ไปยัง PostgreSQL ใดก็ได้ผ่าน DATABASE_URL
// ใช้ตอน deploy: DATABASE_URL=postgresql://... node scripts/migrate.mjs
import pg from "pg";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ ต้องตั้ง DATABASE_URL ก่อน");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("connected:", url.replace(/:[^:@/]+@/, ":****@"));

await client.query(readFileSync(join(root, "db", "schema.sql"), "utf8"));
console.log("✓ schema.sql");

const modulesDir = join(root, "db", "modules");
if (existsSync(modulesDir)) {
  for (const f of readdirSync(modulesDir).filter((n) => n.endsWith(".sql")).sort()) {
    await client.query(readFileSync(join(modulesDir, f), "utf8"));
    console.log("✓ module:", f);
  }
}

await client.end();
console.log("✅ migration complete");
