import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { planAllowsPath, minPlanForPath, type PlanTier } from "../components/nav.ts";

// เทสต์ plan gating ของ server action (P1-4):
// - สัญญา tier: path ของแต่ละโมดูลต้องผูกกับแพ็กขั้นต่ำตัวเดียวกับที่ UI ใช้ (PLAN_MIN_FOR_PATH)
//   → free เรียกแล้วโดนปฏิเสธ / แพ็กที่ถูกต้องผ่าน (assertPlanAllows ใน lib/limits.ts
//   throw เมื่อ planAllowsPath(plan, path) === false — เป็น contract เดียวกันเป๊ะ,
//   import limits.ts ตรง ๆ ใน node --test ไม่ได้เพราะ alias "@/" — ดู comment ใน lib/billing.ts)
// - wiring: ไฟล์ actions.ts ของโม​ดูลที่ gate ต้องเรียก assertPlanAllows ด้วย path ที่ถูกต้อง
//   และเรียก "ก่อน" query DB ครั้งแรก (gate ที่จุดเข้า ไม่ใช่หลัง mutate)

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

type Gated = { file: string; path: string; tier: PlanTier };

const GATED_ACTIONS: Gated[] = [
  // Premium
  { file: "app/(app)/branches/actions.ts", path: "/branches", tier: "premium" },
  { file: "app/(app)/integrations/actions.ts", path: "/integrations", tier: "premium" },
  { file: "app/(app)/transfers/actions.ts", path: "/transfers", tier: "premium" },
  { file: "app/(app)/purchase-orders/actions.ts", path: "/purchase-orders", tier: "premium" },
  { file: "app/(app)/suppliers/actions.ts", path: "/suppliers", tier: "premium" },
  { file: "app/(app)/receivables/actions.ts", path: "/receivables", tier: "premium" },
  { file: "app/(app)/stock-count/actions.ts", path: "/stock-count", tier: "premium" },
  { file: "app/(app)/locations/actions.ts", path: "/locations", tier: "premium" },
  { file: "app/(app)/lots/actions.ts", path: "/lots", tier: "premium" },
  // Pro
  { file: "app/(app)/promotions/actions.ts", path: "/promotions", tier: "pro" },
  { file: "app/(app)/customers/actions.ts", path: "/customers", tier: "pro" },
  { file: "app/(app)/members/actions.ts", path: "/members", tier: "pro" },
  { file: "app/(app)/sales-orders/actions.ts", path: "/sales-orders", tier: "pro" },
  { file: "app/(app)/staff/actions.ts", path: "/staff", tier: "pro" },
];

// ---------- สัญญา tier (ตรงกับ UI — ห้ามเดา tier เอง) ----------

for (const g of GATED_ACTIONS) {
  test(`tier ของ ${g.path} ต้องเป็น ${g.tier} (ตาม PLAN_MIN_FOR_PATH ที่ UI ใช้)`, () => {
    assert.equal(minPlanForPath(g.path), g.tier);
  });

  test(`free เรียก action ที่ gate ด้วย ${g.path} → ต้องโดนปฏิเสธ`, () => {
    assert.equal(planAllowsPath("free", g.path), false);
  });

  test(`แพ็ก ${g.tier} เรียก action ${g.path} → ต้องผ่าน`, () => {
    assert.equal(planAllowsPath(g.tier, g.path), true);
    // premium ครอบทุกอย่าง
    assert.equal(planAllowsPath("premium", g.path), true);
  });

  if (g.tier === "premium") {
    test(`pro เรียก action Premium-only ${g.path} → ต้องโดนปฏิเสธ`, () => {
      assert.equal(planAllowsPath("pro", g.path), false);
    });
  }
}

test("sub-path ก็โดน gate เหมือนกัน (เช่น /purchase-orders/123)", () => {
  assert.equal(planAllowsPath("free", "/purchase-orders/123"), false);
  assert.equal(planAllowsPath("pro", "/transfers/abc"), false);
  assert.equal(planAllowsPath("premium", "/transfers/abc"), true);
});

test("path ฟรีต้องไม่โดน gate — ห้ามล็อก POS/สินค้า/ตั้งค่าของร้านฟรี", () => {
  for (const p of [
    "/dashboard",
    "/pos",
    "/products",
    "/sales",
    "/returns",
    "/shifts",
    "/goods-receipt",
    "/stock-issue",
    "/settings",
    "/billing",
  ]) {
    assert.equal(minPlanForPath(p), "free", `${p} ต้องเป็น free`);
    assert.equal(planAllowsPath("free", p), true);
  }
});

// ---------- wiring: action ต้องเรียก assertPlanAllows จริง และเรียกก่อนแตะ DB ----------

for (const g of GATED_ACTIONS) {
  test(`${g.file} ต้องเรียก assertPlanAllows("${g.path}") ก่อน query DB ครั้งแรก`, () => {
    const src = readFileSync(join(ROOT, g.file), "utf8");

    assert.match(
      src,
      /import\s*\{[^}]*\bassertPlanAllows\b[^}]*\}\s*from\s*"@\/lib\/limits"/,
      "ต้อง import assertPlanAllows จาก @/lib/limits",
    );

    const gateCall = `assertPlanAllows(ctx.subscription, "${g.path}")`;
    const gateAt = src.indexOf(gateCall);
    assert.notEqual(gateAt, -1, `ไม่พบ ${gateCall}`);

    // gate ต้องมาก่อนการแตะ DB ครั้งแรกของไฟล์ (mutation แรกคือ action ที่ gate)
    const dbAt = src.search(/await (query|one)\(/);
    if (dbAt !== -1) {
      assert.ok(
        gateAt < dbAt,
        `gate (${gateAt}) ต้องอยู่ก่อน DB call แรก (${dbAt}) — ห้าม mutate ก่อนเช็คแพ็ก`,
      );
    }
  });
}
