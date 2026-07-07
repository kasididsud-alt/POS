import { test } from "node:test";
import assert from "node:assert/strict";
import { bahtText } from "../lib/format.ts";

test("bahtText ศูนย์", () => {
  assert.equal(bahtText(0), "ศูนย์บาทถ้วน");
});

test("bahtText จำนวนเต็ม → ...บาทถ้วน", () => {
  assert.equal(bahtText(100), "หนึ่งร้อยบาทถ้วน");
  assert.equal(bahtText(21), "ยี่สิบเอ็ดบาทถ้วน");
  assert.equal(bahtText(11), "สิบเอ็ดบาทถ้วน");
});

test("bahtText มีสตางค์", () => {
  assert.equal(
    bahtText(1250.5),
    "หนึ่งพันสองร้อยห้าสิบบาทห้าสิบสตางค์",
  );
});

test("bahtText หลักล้าน", () => {
  assert.equal(bahtText(1_000_000), "หนึ่งล้านบาทถ้วน");
});

test("bahtText ติดลบ นำหน้าด้วย 'ลบ'", () => {
  assert.ok(bahtText(-50).startsWith("ลบ"));
});
