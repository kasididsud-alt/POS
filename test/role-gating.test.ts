import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isOwnerOnlyPath, OWNER_ONLY_PATHS } from "../components/nav.ts";

// เทสต์ role gating ของหน้า owner-only:
// - สัญญา: ทุก path ใน OWNER_ONLY_PATHS (รวม sub-path) ต้องถูกนับเป็น owner-only
//   และ path ปฏิบัติงานของพนักงาน (POS/สินค้า/กะ ฯลฯ) ต้องไม่โดนล็อก
// - wiring: (app)/layout.tsx ต้องเรียก assertRoleForPath ด้วย role+pathname จริง
//   (เมนูที่ซ่อนใน navGroupsForRole กันแค่ตอน render — พิมพ์ URL ตรงต้องโดน guard ที่ layout)
//   assertRoleForPath ใน lib/limits.ts redirect เมื่อ role !== "owner" && isOwnerOnlyPath(path)
//   — contract เดียวกับที่เทสต์ตรงนี้ (import limits.ts ตรง ๆ ใน node --test ไม่ได้เพราะ alias "@/")

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---------- สัญญา: หน้า owner-only ----------

for (const p of OWNER_ONLY_PATHS) {
  test(`${p} เป็นหน้า owner-only (พนักงานต้องเข้าไม่ได้)`, () => {
    assert.equal(isOwnerOnlyPath(p), true);
  });

  test(`sub-path ${p}/xxx ก็ต้องเป็น owner-only ด้วย`, () => {
    assert.equal(isOwnerOnlyPath(p + "/xxx"), true);
  });
}

// path ที่ต้องกันได้จริงตามที่ตรวจพบช่องโหว่ (พนักงานเคยพิมพ์ URL ตรงเข้าได้)
for (const p of ["/reports", "/vat-report", "/audit", "/receivables"]) {
  test(`ช่องโหว่เดิม: พนักงานพิมพ์ URL ตรง ${p} ต้องโดนกัน`, () => {
    assert.equal(isOwnerOnlyPath(p), true);
  });
}

// ---------- สัญญา: หน้าปฏิบัติงานของพนักงานต้องไม่โดนล็อก ----------

for (const p of [
  "/dashboard",
  "/pos",
  "/products",
  "/categories",
  "/customers",
  "/shifts",
  "/returns",
  "/goods-receipt",
  "/stock-issue",
  "/transfers",
  "/stock-count",
  "/account",
  "/alerts",
]) {
  test(`${p} ไม่ใช่ owner-only (พนักงานใช้งานได้)`, () => {
    assert.equal(isOwnerOnlyPath(p), false);
  });
}

// กัน false-positive จาก prefix เฉย ๆ (ไม่ใช่ sub-path จริง)
test("prefix คล้ายกันแต่ไม่ใช่ sub-path ต้องไม่โดนล็อก", () => {
  assert.equal(isOwnerOnlyPath("/staffing"), false);
  assert.equal(isOwnerOnlyPath("/reportsx"), false);
});

// ---------- wiring: layout ต้องบังคับ role จริง ----------

test("(app)/layout.tsx เรียก assertRoleForPath(role, pathname) หลังอ่าน x-pathname", () => {
  const src = readFileSync(join(ROOT, "app/(app)/layout.tsx"), "utf8");
  assert.match(src, /assertRoleForPath\(role,\s*pathname\)/);
  // ต้อง guard ตรง layout เดียวกับ plan gate (จุดครอบทุกหน้า)
  assert.match(src, /assertPlanForPath\(ctx\.subscription,\s*pathname\)/);
});

test("lib/limits.ts: assertRoleForPath redirect เฉพาะ non-owner บน owner-only path", () => {
  const src = readFileSync(join(ROOT, "lib/limits.ts"), "utf8");
  const fn = src.slice(src.indexOf("export function assertRoleForPath"));
  assert.match(fn, /role !== "owner"/);
  assert.match(fn, /isOwnerOnlyPath\(path\)/);
  assert.match(fn, /redirect\("\/dashboard"\)/);
});

// /dashboard ต้องไม่อยู่ใน OWNER_ONLY_PATHS — ไม่งั้น redirect วนลูป
test("ปลายทาง redirect (/dashboard) ต้องไม่เป็น owner-only เอง", () => {
  assert.equal(isOwnerOnlyPath("/dashboard"), false);
});
