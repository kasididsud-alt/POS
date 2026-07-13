import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) =>
  readFile(new URL("../" + path, import.meta.url), "utf8");

test("Hero uses the selected local image accessibly", async () => {
  const hero = await read("components/landing/Hero.tsx");
  assert.match(hero, /retail-command-center\.png/);
  assert.match(hero, /alt=""/);
  assert.match(hero, /preload/);
  assert.match(hero, /sizes="100vw"/);
});

test("Ticker loops, pauses, and supports reduced motion", async () => {
  const [ticker, css] = await Promise.all([
    read("components/landing/LiveTicker.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(ticker, /aria-hidden="true"/);
  assert.match(ticker, /tabIndex=\{0\}/);
  assert.match(css, /\.lp-ticker:hover/);
  assert.match(css, /\.lp-ticker:focus-within/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("Hero stat cards stay clear of the tablet photo subject", async () => {
  const css = await read("app/globals.css");
  assert.match(css, /--lp-hero-media-height:/);
  assert.match(css, /padding-top: var\(--lp-hero-media-height\)/);
  assert.match(css, /\.lp-hero-stats \{[\s\S]*?width: min\(100%, 24rem\)/);
});
