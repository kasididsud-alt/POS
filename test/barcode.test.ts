import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ean13CheckDigit,
  generateInternalEAN13,
  isValidEAN13,
} from "../lib/barcode.ts";

test("ean13CheckDigit ค่ามาตรฐานที่รู้ผล", () => {
  // 590123412345 → check digit 7 (ตัวอย่างมาตรฐาน EAN-13)
  assert.equal(ean13CheckDigit("590123412345"), 7);
});

test("generateInternalEAN13 คืนเลข 13 หลักที่ valid เสมอ", () => {
  for (const seq of [1, 2, 99, 12345, 9_999_999_999]) {
    const code = generateInternalEAN13(seq);
    assert.match(code, /^\d{13}$/);
    assert.ok(isValidEAN13(code), `code ${code} ไม่ valid`);
    assert.ok(code.startsWith("20"), "ต้องขึ้นต้นด้วย prefix 20 (in-store)");
  }
});

test("generateInternalEAN13 seq ต่างกัน → เลขไม่ซ้ำ", () => {
  const a = generateInternalEAN13(1);
  const b = generateInternalEAN13(2);
  assert.notEqual(a, b);
});

test("isValidEAN13 ปฏิเสธของเสีย", () => {
  assert.equal(isValidEAN13("2000000000014"), false); // check digit ผิด
  assert.equal(isValidEAN13("abc"), false);
  assert.equal(isValidEAN13("200000000001"), false); // 12 หลัก
  assert.equal(isValidEAN13("20000000000156"), false); // 14 หลัก
});
