import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const asset = new URL(
  "../public/images/landing/retail-command-center.png",
  import.meta.url,
);

test("landing hero asset is the selected 1672x941 PNG", async () => {
  const bytes = await readFile(asset);
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(bytes.readUInt32BE(16), 1672);
  assert.equal(bytes.readUInt32BE(20), 941);
  assert.ok(bytes.byteLength > 500_000);
});
