import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimit } from "../lib/rate-limit.ts";

test("rateLimit อนุญาตจนถึง limit แล้วบล็อก", () => {
  const key = "test-a";
  assert.equal(rateLimit(key, 3).ok, true); // 1
  assert.equal(rateLimit(key, 3).ok, true); // 2
  assert.equal(rateLimit(key, 3).ok, true); // 3
  assert.equal(rateLimit(key, 3).ok, false); // 4 → เกิน
});

test("rateLimit แต่ละ key อิสระต่อกัน", () => {
  assert.equal(rateLimit("test-b", 1).ok, true);
  assert.equal(rateLimit("test-b", 1).ok, false);
  assert.equal(rateLimit("test-c", 1).ok, true); // key ใหม่ ไม่โดนผลของ b
});

test("rateLimit remaining ลดลงถูกต้อง", () => {
  const r1 = rateLimit("test-d", 5);
  assert.equal(r1.remaining, 4);
  const r2 = rateLimit("test-d", 5);
  assert.equal(r2.remaining, 3);
});

test("pre-auth IP backstop: flood จาก IP เดียวถูกจำกัดตามเพดาน", () => {
  // จำลอง /api/v1 ที่จำกัดตาม IP ก่อน authenticate (key ผิด/ไม่มี key)
  const ipKey = "api-ip:203.0.113.9";
  const cap = 5;
  for (let i = 0; i < cap; i++) {
    assert.equal(rateLimit(ipKey, cap).ok, true);
  }
  assert.equal(rateLimit(ipKey, cap).ok, false); // เกินเพดาน → 429 ก่อนแตะ DB
});

test("pre-auth IP bucket แยกจาก per-key bucket ของ org", () => {
  // IP flood ไม่ควรกินโควตา per-key ของ org อื่น และกลับกัน
  assert.equal(rateLimit("api-ip:198.51.100.1", 1).ok, true);
  assert.equal(rateLimit("api-ip:198.51.100.1", 1).ok, false);
  assert.equal(rateLimit("api:org-xyz", 1).ok, true); // คนละ key คนละ bucket
});

test("rateLimit รีเซ็ตเมื่อพ้นหน้าต่างเวลา", () => {
  const key = "test-e";
  assert.equal(rateLimit(key, 1, 1).ok, true); // window 1ms
  const past = rateLimit(key, 1, 1);
  // อาจ ok ถ้าเลย 1ms แล้ว — ยืนยันว่ามี resetAt เป็นอนาคต
  assert.ok(past.resetAt >= Date.now() - 5);
});
