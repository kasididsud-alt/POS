import assert from "node:assert/strict";
import test from "node:test";
import {
  FAQ_ITEMS,
  FEATURES,
  OUTCOMES,
  STORE_TYPES,
  TICKER_ITEMS,
  WORKFLOW_STEPS,
} from "../components/landing/content.ts";

test("landing content covers the approved retail story", () => {
  assert.equal(OUTCOMES.length, 3);
  assert.equal(WORKFLOW_STEPS.length, 4);
  assert.equal(FEATURES.length, 6);
  assert.equal(STORE_TYPES.length, 4);
  assert.ok(TICKER_ITEMS.length >= 5);
  assert.ok(FAQ_ITEMS.length >= 4);
});

test("landing content contains no unverified social proof", () => {
  const copy = JSON.stringify({
    FAQ_ITEMS,
    FEATURES,
    OUTCOMES,
    STORE_TYPES,
    TICKER_ITEMS,
    WORKFLOW_STEPS,
  });
  assert.doesNotMatch(copy, /500\+|2\.4M|4\.8\/5|99\.9%|ร้านจริงใช้จริง|ความพึงพอใจ/);
});

test("all repeated items have unique stable ids", () => {
  for (const items of [
    FAQ_ITEMS,
    FEATURES,
    OUTCOMES,
    STORE_TYPES,
    TICKER_ITEMS,
    WORKFLOW_STEPS,
  ]) {
    assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  }
});
