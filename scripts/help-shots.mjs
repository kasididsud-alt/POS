// ถ่ายภาพหน้าจอจริงสำหรับหน้า "วิธีใช้งาน" (/help) → public/help/*.png
// ใช้: node scripts/help-shots.mjs [baseUrl]   (ค่าปกติ http://localhost:3020)
//
// วิธีทำงาน: สร้าง session ชั่วคราวให้ user เจ้าของร้านตัวแรกใน DB → เปิด Chrome
// ในเครื่องแบบ headless พร้อม cookie นั้น → ไล่ถ่ายทีละหน้า → ลบ session ทิ้ง
// รันซ้ำได้ทุกครั้งที่หน้าตาแอปเปลี่ยน แล้วภาพในคู่มืออัปเดตเอง
import pg from "pg";
import puppeteer from "puppeteer-core";
import { randomBytes } from "node:crypto";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = process.argv[2] ?? "http://localhost:3020";

// DATABASE_URL จาก env หรือ .env.local
let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  const env = readFileSync(join(root, ".env.local"), "utf8");
  dbUrl = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
}
if (!dbUrl) {
  console.error("❌ ไม่พบ DATABASE_URL");
  process.exit(1);
}

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = join(root, "public", "help");
mkdirSync(OUT, { recursive: true });

const db = new pg.Client({ connectionString: dbUrl });
await db.connect();

// เลือกร้านที่ถ่ายได้ครบทุกหน้า: แพ็ก premium ก่อน (ผ่าน plan gate ทุกเมนู)
// แล้วค่อยร้านที่เปิด VAT / มีบิลเยอะ (ภาพจะมีข้อมูลจริงให้เห็น)
const { rows: owners } = await db.query(
  `select u.id, u.email, m.org_id
     from users u
     join memberships m on m.user_id = u.id and m.role = 'owner'
     join organizations o on o.id = m.org_id
     left join subscriptions s on s.org_id = o.id
    order by (s.comp_plan = 'premium') desc nulls last,
             o.vat_registered desc,
             (select count(*) from sales where org_id = o.id) desc
    limit 1`,
);
if (!owners.length) {
  console.error("❌ ไม่พบ user เจ้าของร้านใน DB");
  process.exit(1);
}
const owner = owners[0];
console.log("ถ่ายในนาม:", owner.email);

// บิลล่าสุดของร้าน — ใช้ถ่ายหน้าเอกสารใบกำกับ
const { rows: sales } = await db.query(
  "select id from sales where org_id = $1 order by created_at desc limit 1",
  [owner.org_id],
);
const saleId = sales[0]?.id;

// หน้าที่จะถ่าย — เพิ่มหน้าใหม่ที่นี่
const SHOTS = [
  { file: "pos", path: "/pos" },
  { file: "products", path: "/products" },
  { file: "settings", path: "/settings" },
  { file: "shifts", path: "/shifts" },
  { file: "vat-report", path: "/vat-report" },
  ...(saleId ? [{ file: "sale-doc", path: `/sales/${saleId}?form=full` }] : []),
  { file: "dashboard", path: "/dashboard" },
  { file: "alerts", path: "/alerts" },
  { file: "returns", path: "/returns" },
  { file: "labels", path: "/labels" },
  { file: "categories", path: "/categories" },
  { file: "promotions", path: "/promotions" },
  { file: "lots", path: "/lots" },
  { file: "stock", path: "/stock" },
  { file: "goods-receipt", path: "/goods-receipt" },
  { file: "stock-issue", path: "/stock-issue" },
  { file: "transfers", path: "/transfers" },
  { file: "stock-count", path: "/stock-count" },
  { file: "locations", path: "/locations" },
  { file: "suppliers", path: "/suppliers" },
  { file: "purchase-orders", path: "/purchase-orders" },
  { file: "customers", path: "/customers" },
  { file: "members", path: "/members" },
  { file: "sales-orders", path: "/sales-orders" },
  { file: "receivables", path: "/receivables" },
  { file: "reports", path: "/reports" },
  { file: "billing", path: "/billing" },
  { file: "branches", path: "/branches" },
  { file: "staff", path: "/staff" },
  { file: "audit", path: "/audit" },
  { file: "integrations", path: "/integrations" },
  { file: "account", path: "/account" },
  // จอลูกค้าเปิด SSE ค้างไว้ — networkidle0 ไม่มีวันเกิด ใช้ domcontentloaded + รอนานขึ้นแทน
  { file: "pos-display", path: "/pos-display", waitUntil: "domcontentloaded", settleMs: 2500 },
];

// session ชั่วคราว (อายุ 10 นาที) — ลบทิ้งท้ายสคริปต์อีกชั้น
const token = randomBytes(32).toString("hex");
await db.query(
  "insert into sessions (token, user_id, expires_at) values ($1, $2, now() + interval '10 minutes')",
  [token, owner.id],
);

let browser;
try {
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 850, deviceScaleFactor: 2 });
  const { hostname } = new URL(base);
  await browser.setCookie({
    name: "session",
    value: token,
    domain: hostname,
    path: "/",
    httpOnly: true,
  });

  for (const s of SHOTS) {
    await page.goto(base + s.path, {
      waitUntil: s.waitUntil ?? "networkidle0",
      timeout: 30000,
    });
    // รอฟอนต์/รูปนิ่งก่อนถ่าย
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, s.settleMs ?? 400));
    await page.screenshot({ path: join(OUT, `${s.file}.png`) });
    console.log("✓", s.file + ".png", "←", s.path);
  }
} finally {
  await browser?.close();
  await db.query("delete from sessions where token = $1", [token]);
  await db.end();
}
console.log("✅ เสร็จ — ภาพอยู่ที่ public/help/");
