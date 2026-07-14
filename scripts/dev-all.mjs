// เปิดทุกอย่างด้วยคำสั่งเดียว: npm run dev:all
// = ฐานข้อมูล (scripts/db.mjs) + เว็บ (next dev :3020) ในเทอร์มินัลเดียว
// - ถ้า DB รันอยู่แล้ว (:54322) จะใช้ตัวเดิม ไม่เปิดซ้ำ
// - Ctrl+C ครั้งเดียว ปิดทั้งคู่
import { spawn } from "node:child_process";
import net from "node:net";

const DB_PORT = 54322;
const WEB_PORT = 3020;

function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: "127.0.0.1" });
    s.once("connect", () => {
      s.destroy();
      resolve(true);
    });
    s.once("error", () => resolve(false));
  });
}

async function waitForPort(port, timeoutMs = 90_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await portOpen(port)) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

const children = [];
let exiting = false;
function shutdown(code = 0) {
  if (exiting) return;
  exiting = true;
  for (const c of children) {
    try {
      c.kill("SIGTERM"); // db.mjs ดัก SIGTERM แล้วปิด Postgres ให้เรียบร้อยเอง
    } catch {
      /* ปิดไปแล้ว */
    }
  }
  // เผื่อเวลาให้ Postgres ปิดตัวสวยๆ ก่อนจบโปรเซสแม่
  setTimeout(() => process.exit(code), 1500);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// 1) ฐานข้อมูล
if (await portOpen(DB_PORT)) {
  console.log(`♻️  พบ Postgres รันอยู่แล้วที่ :${DB_PORT} — ใช้ตัวเดิม`);
} else {
  const db = spawn("node", ["scripts/db.mjs"], { stdio: "inherit" });
  children.push(db);
  db.on("exit", (code) => {
    if (!exiting) {
      console.error("\n💥 ฐานข้อมูลหยุดทำงาน — ปิดเว็บตาม");
      shutdown(code ?? 1);
    }
  });
  process.stdout.write("⏳ รอฐานข้อมูลพร้อม...\n");
  if (!(await waitForPort(DB_PORT))) {
    console.error("❌ รอฐานข้อมูลเกินเวลา — ดู error ด้านบน");
    shutdown(1);
  }
}

// 2) เว็บ
if (await portOpen(WEB_PORT)) {
  console.error(
    `❌ พอร์ต ${WEB_PORT} มีคนใช้อยู่ — น่าจะมี dev server เปิดค้าง (ปิดตัวเก่าก่อน หรือใช้ตัวนั้นได้เลย)`,
  );
  shutdown(1);
} else {
  const web = spawn("npx", ["next", "dev", "-p", String(WEB_PORT)], {
    stdio: "inherit",
  });
  children.push(web);
  web.on("exit", (code) => shutdown(code ?? 0));
}
