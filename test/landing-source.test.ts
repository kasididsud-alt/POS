import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) =>
  readFile(new URL("../" + path, import.meta.url), "utf8");

test("Hero uses the selected local image accessibly", async () => {
  const hero = await read("components/landing/Hero.tsx");
  const image = hero.match(/<Image\b[\s\S]*?\/>/)?.[0];
  assert.ok(image, "Hero must render a next/image Image tag");
  assert.match(image, /retail-command-center\.png/);
  assert.match(image, /alt=""/);
  assert.match(image, /\bpreload(?:=\{true\})?(?=\s|\/>)/);
  assert.doesNotMatch(image, /\bpreload=\{false\}/);
  assert.doesNotMatch(image, /\bpriority\b/);
  assert.match(image, /sizes="100vw"/);
});

test("Ticker loops, pauses, and supports reduced motion", async () => {
  const [ticker, css] = await Promise.all([
    read("components/landing/LiveTicker.tsx"),
    read("app/globals.css"),
  ]);
  const duplicateBranch = ticker.match(/if \(duplicate\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(duplicateBranch, "TickerGroup must branch for the visual duplicate");
  assert.match(
    duplicateBranch,
    /className="lp-ticker-group" aria-hidden="true"/,
  );
  assert.match(ticker, /<TickerGroup duplicate \/>/);
  assert.match(ticker, /tabIndex=\{0\}/);
  assert.match(css, /\.lp-ticker:hover/);
  assert.match(css, /\.lp-ticker:focus-within/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("Hero stat cards stay clear of the tablet photo subject", async () => {
  const [hero, css] = await Promise.all([
    read("components/landing/Hero.tsx"),
    read("app/globals.css"),
  ]);
  for (const label of ["ยอดขายวันนี้", "บิลล่าสุด", "สต็อกใกล้หมด"]) {
    assert.match(hero, new RegExp(label));
  }
  assert.match(css, /--lp-hero-media-height:/);
  assert.match(css, /padding-top: var\(--lp-hero-media-height\)/);
  assert.match(css, /\.lp-hero-stats \{[\s\S]*?width: min\(100%, 24rem\)/);
  assert.doesNotMatch(
    css,
    /\.lp-stat-card[\w-]*\s*\{[^}]*display:\s*none/,
  );
  assert.match(
    css,
    /\.lp-home \.lp-stat-card:first-child\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/,
  );
});

test("Homepage theme is isolated from shared public page primitives", async () => {
  const [css, plan] = await Promise.all([
    read("app/globals.css"),
    read("docs/superpowers/plans/2026-07-13-pos-index-redesign.md"),
  ]);
  const sharedTheme = css.match(/\.lp \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(sharedTheme, "shared .lp theme must remain defined");
  assert.match(sharedTheme, /--paper:\s*#f7faf7/);
  assert.doesNotMatch(sharedTheme, /--lp-canvas/);
  assert.match(css, /\.lp\.lp-home\s*\{[\s\S]*?--lp-canvas:\s*#f5f8fc/);
  assert.match(css, /\.lp-led-track\s*\{/);
  assert.match(css, /\.lp-home \.lp-header\s*\{/);
  assert.match(plan, /<div className="lp lp-home">/);
  const homeTheme = css.match(
    /\/\* BEGIN: lp-home theme \*\/([\s\S]*?)\/\* END: lp-home theme \*\//,
  )?.[1];
  assert.ok(homeTheme, "homepage theme must have an auditable scoped block");
  assert.doesNotMatch(homeTheme, /^\s*\.lp(?!-home\b|\.lp-home\b)/m);
});

test("Homepage overrides shared card motion with safe transitions", async () => {
  const css = await read("app/globals.css");
  const homeTheme = css.match(
    /\/\* BEGIN: lp-home theme \*\/([\s\S]*?)\/\* END: lp-home theme \*\//,
  )?.[1];
  assert.ok(homeTheme, "homepage theme must have an auditable scoped block");
  const homeCard = homeTheme.match(/\.lp-home \.lp-card\s*\{([^}]*)\}/)?.[1];
  assert.ok(homeCard, "homepage card must override the shared .lp-card rule");
  const cardTransition = homeCard.match(/\btransition\s*:\s*([^;]+)/)?.[1];
  assert.ok(
    cardTransition,
    "homepage card must reset the shared paint-property transition",
  );
  const cardProperties = cardTransition
    .split(",")
    .map((item) => item.trim().split(/\s+/)[0])
    .sort();
  assert.deepEqual(cardProperties, ["opacity", "transform"]);

  const transitions = [
    ...homeTheme.matchAll(/transition(?:-property)?\s*:\s*([^;]+)/g),
  ];
  assert.ok(transitions.length > 0, "homepage theme should retain safe motion");
  for (const [, value] of transitions) {
    for (const item of value.split(",")) {
      const property = item.trim().split(/\s+/)[0];
      assert.ok(
        property === "transform" || property === "opacity",
        `homepage transition animates paint property: ${property}`,
      );
    }
  }
});

test("Product Showcase represents a real retail checkout", async () => {
  const source = await read("components/landing/ProductShowcase.tsx");
  assert.match(source, /id="product"/);
  assert.match(source, /ตะกร้าสินค้า/);
  assert.match(source, /พร้อมเพย์/);
  assert.match(source, /เก็บเงิน ฿175/);
  assert.doesNotMatch(source, /ร้านอาหาร|คาเฟ่/);
});
