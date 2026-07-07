import { test } from "node:test";
import assert from "node:assert/strict";
import { vatInclusive } from "../lib/vat.ts";

test("vatInclusive ถอด VAT 7% จากยอดรวม 107 → ฐาน 100 / ภาษี 7", () => {
  const r = vatInclusive(107, 7);
  assert.equal(r.base, 100);
  assert.equal(r.vat, 7);
  assert.equal(r.total, 107);
});

test("vatInclusive ยอดใหญ่ 1070 @7% → ฐาน 1000 / ภาษี 70", () => {
  const r = vatInclusive(1070, 7);
  assert.equal(r.base, 1000);
  assert.equal(r.vat, 70);
});

test("vatInclusive rate 0 → ไม่มีภาษี, ฐาน = total", () => {
  const r = vatInclusive(100, 0);
  assert.equal(r.vat, 0);
  assert.equal(r.base, 100);
});

test("vatInclusive: base + vat ≈ total (คลาดไม่เกินครึ่งสตางค์)", () => {
  for (const amt of [99.99, 150.5, 1234.56, 7, 0.03]) {
    const r = vatInclusive(amt, 7);
    assert.ok(
      Math.abs(r.base + r.vat - r.total) < 0.005,
      `เพี้ยนเกินครึ่งสตางค์ที่ ${amt}`,
    );
  }
});

test("vatInclusive ค่าขยะ → 0 อย่างปลอดภัย", () => {
  const r = vatInclusive(NaN as unknown as number, 7);
  assert.equal(r.total, 0);
  assert.equal(r.vat, 0);
});
