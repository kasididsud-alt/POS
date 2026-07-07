import { test } from "node:test";
import assert from "node:assert/strict";
import { safeInternalPath } from "../lib/safe-redirect.ts";

test("safeInternalPath ผ่าน path ภายในปกติ", () => {
  assert.equal(safeInternalPath("/dashboard"), "/dashboard");
  assert.equal(safeInternalPath("/sales/123?form=full"), "/sales/123?form=full");
  assert.equal(safeInternalPath("/"), "/");
});

test("safeInternalPath บล็อก absolute URL ภายนอก → fallback", () => {
  assert.equal(safeInternalPath("https://evil.example/phish"), "/dashboard");
  assert.equal(safeInternalPath("http://evil.example"), "/dashboard");
  assert.equal(safeInternalPath("javascript:alert(1)"), "/dashboard");
});

test("safeInternalPath บล็อก protocol-relative //host → fallback", () => {
  assert.equal(safeInternalPath("//evil.com"), "/dashboard");
  assert.equal(safeInternalPath("//evil.com/path"), "/dashboard");
});

test("safeInternalPath บล็อก backslash trick /\\host และแบบ encode → fallback", () => {
  assert.equal(safeInternalPath("/\\evil.com"), "/dashboard");
  assert.equal(safeInternalPath("/%5Cevil.com"), "/dashboard");
  assert.equal(safeInternalPath("/%5cevil.com"), "/dashboard");
});

test("safeInternalPath ค่าว่าง/ชนิดผิด → fallback", () => {
  assert.equal(safeInternalPath(""), "/dashboard");
  assert.equal(safeInternalPath(null), "/dashboard");
  assert.equal(safeInternalPath(undefined), "/dashboard");
  assert.equal(safeInternalPath(123), "/dashboard");
});

test("safeInternalPath รองรับ fallback ที่กำหนดเอง", () => {
  assert.equal(safeInternalPath("//evil.com", "/login"), "/login");
});
