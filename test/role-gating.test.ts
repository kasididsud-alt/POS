import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  minRoleForPath,
  roleAllowsPath,
  MIN_ROLE_FOR_PATH,
  ROLE_RANK,
  type Role,
} from "../components/nav.ts";

// เทสต์ role gating 3 ระดับ (cashier < manager < owner):
// - สัญญาระดับหน้า: MIN_ROLE_FOR_PATH ต้องตรงตารางสิทธิ์ที่ตกลงกัน (รวม sub-path)
//   และหน้าปฏิบัติงานของพนักงานต้องไม่โดนล็อก
// - wiring ระดับหน้า: (app)/layout.tsx เรียก assertRoleForPath(role, pathname)
//   (เมนูที่ซ่อนกันแค่ตอน render — พิมพ์ URL ตรงต้องโดน guard ที่ layout)
// - wiring ระดับ action: action ที่ "เปลี่ยนความจริงย้อนหลัง" (ราคา/ลบ/ปรับยอด/แต้ม/ใบโอน)
//   ต้องเรียก assertRoleAtLeast(..., "manager") ในไฟล์ actions.ts ของโมดูลนั้น
//   (import limits.ts ตรง ๆ ใน node --test ไม่ได้เพราะ alias "@/" — เทสต์ contract ผ่าน nav.ts
//   ที่เป็นแหล่ง ROLE_RANK เดียวกัน + เทสต์ wiring จากซอร์ส แนวเดียวกับ test/plan-gating.test.ts)

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

// ---------- สัญญา: หน้าระดับผู้จัดการขึ้นไป ----------

const MANAGER_PATHS = ["/suppliers", "/purchase-orders", "/promotions"];
for (const p of MANAGER_PATHS) {
  test(`${p} ขั้นต่ำผู้จัดการ: cashier โดนกัน / manager+owner ผ่าน`, () => {
    assert.equal(minRoleForPath(p), "manager");
    assert.equal(roleAllowsPath("cashier", p), false);
    assert.equal(roleAllowsPath("manager", p), true);
    assert.equal(roleAllowsPath("owner", p), true);
  });
}

// ---------- สัญญา: หน้าเจ้าของเท่านั้น ----------

const OWNER_PATHS = [
  "/receivables",
  "/reports",
  "/vat-report",
  "/settings",
  "/billing",
  "/branches",
  "/staff",
  "/audit",
  "/integrations",
];
for (const p of OWNER_PATHS) {
  test(`${p} เจ้าของเท่านั้น: cashier และ manager โดนกัน`, () => {
    assert.equal(minRoleForPath(p), "owner");
    assert.equal(roleAllowsPath("cashier", p), false);
    assert.equal(roleAllowsPath("manager", p), false);
    assert.equal(roleAllowsPath("owner", p), true);
  });

  test(`sub-path ${p}/xxx ก็โดน gate เหมือนกัน`, () => {
    assert.equal(roleAllowsPath("manager", p + "/xxx"), false);
  });
}

// ตารางใน nav.ts ต้องมีแค่ที่ประกาศไว้ในเทสต์นี้ — เพิ่ม path ใหม่ต้องอัปเดตเทสต์ให้คิดเรื่องสิทธิ์
test("MIN_ROLE_FOR_PATH ครบตามตารางที่ตกลง (ไม่มี path แปลกปลอม)", () => {
  assert.deepEqual(
    Object.keys(MIN_ROLE_FOR_PATH).sort(),
    [...MANAGER_PATHS, ...OWNER_PATHS].sort(),
  );
});

// ---------- สัญญา: หน้าปฏิบัติงานของพนักงานต้องไม่โดนล็อก ----------

for (const p of [
  "/dashboard",
  "/pos",
  "/products",
  "/categories",
  "/customers",
  "/members",
  "/shifts",
  "/returns",
  "/goods-receipt",
  "/stock-issue",
  "/transfers",
  "/stock-count",
  "/sales-orders",
  "/lots",
  "/locations",
  "/labels",
  "/account",
  "/alerts",
]) {
  test(`${p} พนักงานเข้าดู/ทำงานหน้าร้านได้ (ของต้องห้ามกันที่ระดับ action)`, () => {
    assert.equal(roleAllowsPath("cashier", p), true);
  });
}

test("prefix คล้ายกันแต่ไม่ใช่ sub-path ต้องไม่โดนล็อก", () => {
  assert.equal(roleAllowsPath("cashier", "/staffing"), true);
  assert.equal(roleAllowsPath("cashier", "/reportsx"), true);
});

test("role แปลก ๆ / ไม่รู้จัก ถูกนับเป็นสิทธิ์ต่ำสุด (พนักงาน)", () => {
  assert.equal(roleAllowsPath("superadmin", "/reports"), false);
  assert.equal(roleAllowsPath("", "/settings"), false);
});

test("ลำดับสิทธิ์ cashier < manager < owner", () => {
  assert.ok(ROLE_RANK.cashier < ROLE_RANK.manager);
  assert.ok(ROLE_RANK.manager < ROLE_RANK.owner);
});

test("ปลายทาง redirect (/dashboard) ต้องไม่โดน gate เอง — กันวนลูป", () => {
  assert.equal(minRoleForPath("/dashboard"), "cashier");
});

// ---------- wiring: layout ต้องบังคับ role จริง ----------

test("(app)/layout.tsx เรียก assertRoleForPath(role, pathname) คู่กับ plan gate", () => {
  const src = read("app/(app)/layout.tsx");
  assert.match(src, /assertPlanForPath\(ctx\.subscription,\s*pathname\)/);
  assert.match(src, /assertRoleForPath\(role,\s*pathname\)/);
});

test("lib/limits.ts: assertRoleForPath ใช้ roleAllowsPath + redirect /dashboard, assertRoleAtLeast ใช้ ROLE_RANK", () => {
  const src = read("lib/limits.ts");
  const forPath = src.slice(src.indexOf("export function assertRoleForPath"));
  assert.match(forPath, /roleAllowsPath\(role,\s*path\)/);
  assert.match(forPath, /redirect\("\/dashboard"\)/);
  const atLeast = src.slice(src.indexOf("export function assertRoleAtLeast"));
  assert.match(atLeast, /ROLE_RANK/);
  assert.match(atLeast, /throw new Error/);
});

// ---------- wiring: action ที่จำกัดผู้จัดการขึ้นไป ----------
// {ไฟล์: จำนวนจุดที่ต้องมี assertRoleAtLeast(..., "manager") ขั้นต่ำ}

const MANAGER_GATED_ACTIONS: Record<string, number> = {
  // แก้ไขสินค้าเดิม + ปรับยอดรับเข้า + ปรับลด + ลบสินค้า
  "app/(app)/products/actions.ts": 4,
  "app/(app)/categories/actions.ts": 1, // ลบหมวด
  "app/(app)/customers/actions.ts": 1, // ลบลูกค้า
  "app/(app)/members/actions.ts": 1, // ปรับแต้ม
  "app/(app)/stock-count/actions.ts": 1, // ยืนยันผลนับ
  "app/(app)/stock-issue/actions.ts": 1, // ตัดจ่าย
  "app/(app)/transfers/actions.ts": 2, // สร้าง + รับ/ยกเลิกใบโอน
  "app/(app)/sales-orders/actions.ts": 2, // สร้าง + เปลี่ยนสถานะ
  "app/(app)/lots/actions.ts": 2, // บันทึก + ลบ
  "app/(app)/locations/actions.ts": 2, // บันทึก + ลบ
  "app/(app)/promotions/actions.ts": 1, // requireOrg กลาง
  "app/(app)/suppliers/actions.ts": 1, // requireOrg กลาง
  "app/(app)/purchase-orders/actions.ts": 3, // สร้าง + รับของ + ยกเลิก
};

for (const [file, minCount] of Object.entries(MANAGER_GATED_ACTIONS)) {
  test(`${file} มี assertRoleAtLeast(..., "manager") อย่างน้อย ${minCount} จุด`, () => {
    const src = read(file);
    assert.match(src, /import \{[^}]*assertRoleAtLeast[^}]*\} from "@\/lib\/limits"/);
    const calls =
      src.match(/assertRoleAtLeast\([^)]*,\s*"manager"\)/g)?.length ?? 0;
    assert.ok(
      calls >= minCount,
      `พบ ${calls} จุด (ต้องมีอย่างน้อย ${minCount})`,
    );
  });
}

// ---------- wiring: จัดการทีมงานรองรับ role manager ----------

test('staff/actions.ts whitelist บทบาทต้องมี "manager" (ทั้ง invite และ changeRole)', () => {
  const src = read("app/(app)/staff/actions.ts");
  const hits = src.match(/\["owner", "manager", "cashier"\]/g)?.length ?? 0;
  assert.ok(hits >= 2, `พบ whitelist ครบ 3 บทบาทแค่ ${hits} จุด (ต้อง 2)`);
});

test("schema + migration 29 ยอมรับ role manager ใน memberships", () => {
  assert.match(
    read("db/schema.sql"),
    /role in \('owner','manager','cashier'\)/,
  );
  assert.match(
    read("db/modules/29_manager_role.sql"),
    /check \(role in \('owner', 'manager', 'cashier'\)\)/,
  );
});
