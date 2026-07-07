// Local PostgreSQL (embedded) — รัน Postgres จริงบนเครื่องโดยไม่ต้องใช้ Docker
// ใช้: npm run db   (เปิดค้างไว้ในเทอร์มินัลหนึ่ง)
import EmbeddedPostgres from "embedded-postgres";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, ".localdb");
const PORT = 54322;

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: PORT,
  persistent: true,
});

if (!existsSync(join(dataDir, "PG_VERSION"))) {
  console.log("⏳ initialising database (ครั้งแรกดาวน์โหลด binary)...");
  await pg.initialise();
}

await pg.start();
console.log(`🐘 Local Postgres started on :${PORT}`);

const client = pg.getPgClient();
await client.connect();
await client.query(readFileSync(join(root, "db", "schema.sql"), "utf8"));

// apply โมดูลเสริมตามลำดับชื่อไฟล์ (idempotent ทั้งหมด)
const modulesDir = join(root, "db", "modules");
if (existsSync(modulesDir)) {
  for (const f of readdirSync(modulesDir).filter((n) => n.endsWith(".sql")).sort()) {
    await client.query(readFileSync(join(modulesDir, f), "utf8"));
    console.log("  + module:", f);
  }
}
await client.end();
console.log("✅ schema applied — DB พร้อมใช้งาน");
console.log("   DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres");

async function shutdown() {
  console.log("\n🛑 stopping Postgres...");
  try {
    await pg.stop();
  } finally {
    process.exit(0);
  }
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// คงโปรเซสไว้ให้ Postgres รันต่อ
await new Promise(() => {});
