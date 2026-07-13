import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) =>
  readFile(new URL("../" + path, import.meta.url), "utf8");

const LANDING_SECTION_EXPORTS = [
  "Outcomes",
  "RetailWorkflow",
  "FeatureGrid",
  "StoreFit",
  "LandingFaq",
  "ClosingCta",
  "LandingFooter",
] as const;

const exportedFunctionSource = (
  source: string,
  exportName: (typeof LANDING_SECTION_EXPORTS)[number],
) => {
  const marker = `export function ${exportName}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${exportName} export must exist`);
  const nextStart = source.indexOf("\nexport function ", start + marker.length);
  return source.slice(start, nextStart === -1 ? source.length : nextStart);
};

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

test("Product Showcase keeps the ขายดี Stock brand", async () => {
  const source = await read("components/landing/ProductShowcase.tsx");
  assert.match(source, />ขายดี Stock</);
  assert.doesNotMatch(source, />ขายดี POS</);
});

test("Product Showcase keeps benefit descriptions readable on mobile", async () => {
  const source = await read("components/landing/ProductShowcase.tsx");
  const benefitDescription = source.match(
    /<span className="([^"]*)">\s*\{benefit\.description\}\s*<\/span>/,
  );
  assert.ok(benefitDescription, "benefit description classes must be auditable");
  assert.match(benefitDescription[1], /(?:^|\s)text-base(?:\s|$)/);
  assert.doesNotMatch(benefitDescription[1], /(?:^|\s)text-(?:xs|sm)(?:\s|$)/);
});

test("Product Showcase uses high-contrast labels", async () => {
  const source = await read("components/landing/ProductShowcase.tsx");
  const paperLabels = [...source.matchAll(/className="([^"]*)"/g)]
    .map((match) => match[1])
    .filter((classes) => classes.includes("bg-[var(--paper-2)]"));
  assert.ok(paperLabels.length > 0, "paper labels must remain auditable");
  for (const classes of paperLabels) {
    assert.doesNotMatch(classes, /text-\[var\(--green\)\]/);
    assert.match(classes, /text-\[var\(--green-d\)\]/);
  }

  const checkoutLabel = source.match(
    /className="([^"]*)"[^>]*>\s*เก็บเงิน ฿175\s*</,
  );
  assert.ok(checkoutLabel, "checkout label classes must be auditable");
  assert.doesNotMatch(checkoutLabel[1], /opacity/);
});

test("Product Showcase demo controls are static semantic content", async () => {
  const source = await read("components/landing/ProductShowcase.tsx");
  assert.doesNotMatch(source, /<button\b/);
  assert.doesNotMatch(source, /\bdisabled\b|cursor-not-allowed/);
  assert.match(source, /<ul[^>]*aria-label="สินค้าขายดี"/);
  assert.match(source, /<ul[^>]*aria-label="วิธีชำระเงิน"/);
});

test("Product Showcase checkout affordance is clearly a preview", async () => {
  const source = await read("components/landing/ProductShowcase.tsx");
  const checkoutBlock =
    source.match(
      /<div\s+className="[^"]*"[^>]*aria-labelledby="checkout-preview-label"[^>]*>[\s\S]*?<\/div>/,
    )?.[0] ??
    source.match(
      /<p className="[^"]*"[^>]*>\s*เก็บเงิน ฿175\s*<\/p>/,
    )?.[0];
  assert.ok(checkoutBlock, "checkout preview block must be auditable");
  assert.doesNotMatch(
    checkoutBlock,
    /bg-\[var\(--green\)\]|text-white|shadow-/,
  );
  assert.match(checkoutBlock, /border-dashed/);
  assert.match(checkoutBlock, /bg-\[var\(--lp-mint\)\]\/15/);
  assert.match(checkoutBlock, /ตัวอย่างหน้าจอชำระเงิน/);
  assert.match(checkoutBlock, /เก็บเงิน ฿175/);
});

test("landing sections expose the approved conversion sequence", async () => {
  const source = await read("components/landing/LandingSections.tsx");
  for (const exportName of LANDING_SECTION_EXPORTS) {
    assert.match(source, new RegExp("export function " + exportName));
  }
  assert.match(source, /id="features"/);
  assert.match(source, /<details/);
  assert.match(source, /<summary/);
});

test("landing section boundaries each expose exactly one H2", async () => {
  const source = await read("components/landing/LandingSections.tsx");
  for (const exportName of LANDING_SECTION_EXPORTS) {
    const component = exportedFunctionSource(source, exportName);
    assert.equal(
      [...component.matchAll(/<h2\b/g)].length,
      1,
      `${exportName} must render exactly one H2`,
    );
  }
});

test("Closing CTA keeps auth-aware primary routes", async () => {
  const source = await read("components/landing/LandingSections.tsx");
  const closingCta = exportedFunctionSource(source, "ClosingCta");
  assert.match(
    closingCta,
    /const primaryHref = isAuthed \? "\/dashboard" : "\/signup";/,
  );
  assert.match(closingCta, /href="\/pricing"/);
});

test("Landing Footer renders the current year from the server", async () => {
  const source = await read("components/landing/LandingSections.tsx");
  const footer = exportedFunctionSource(source, "LandingFooter");
  assert.match(footer, /new Date\(\)\.getFullYear\(\)/);
  assert.match(footer, /© \{currentYear\}/);
});

test("Landing Footer links guarantee 44 by 44 pixel targets", async () => {
  const source = await read("components/landing/LandingSections.tsx");
  const footer = exportedFunctionSource(source, "LandingFooter");
  const targets = [...footer.matchAll(/<(?:a|Link)\b[\s\S]*?>/g)];
  assert.equal(targets.length, 5, "all five footer links must be auditable");

  for (const [openingTag] of targets) {
    const classes = openingTag.match(/className="([^"]*)"/)?.[1];
    assert.ok(classes, `footer target needs classes: ${openingTag}`);
    const tokens = new Set(classes.split(/\s+/));
    for (const token of ["inline-flex", "min-h-11", "min-w-11", "items-center"]) {
      assert.ok(tokens.has(token), `footer target is missing ${token}`);
    }
  }
});

test("Feature bento uses wide cards only at desktop", async () => {
  const source = await read("components/landing/LandingSections.tsx");
  const featureGrid = exportedFunctionSource(source, "FeatureGrid");
  assert.match(featureGrid, /isWide \? "lg:col-span-2" : ""/);
  assert.doesNotMatch(featureGrid, /md:col-span-2/);
});

test("FAQ arrow transition respects reduced motion", async () => {
  const source = await read("components/landing/LandingSections.tsx");
  const faq = exportedFunctionSource(source, "LandingFaq");
  assert.match(
    faq,
    /transition-transform[^"\n]*motion-reduce:transition-none/,
  );
});

test("public pricing is projected from canonical plan definitions", async () => {
  const [plans, pricing, pricingPage] = await Promise.all([
    read("lib/plans.ts"),
    read("components/landing/Pricing.tsx"),
    read("app/pricing/page.tsx"),
  ]);
  assert.match(plans, /export const PUBLIC_PLANS/);
  assert.match(plans, /const plan = PLANS\[id\]/);
  assert.match(pricing, /tiers: readonly PublicPlanDef\[\]/);
  assert.match(pricingPage, /<Pricing tiers=\{PUBLIC_PLANS\}/);
});

test("index assembles the approved sections without fake proof", async () => {
  const page = await read("app/page.tsx");
  const ordered = [
    "<Hero",
    "<Outcomes",
    "<ProductShowcase",
    "<RetailWorkflow",
    "<FeatureGrid",
    "<StoreFit",
    "<Pricing",
    "<LandingFaq",
    "<ClosingCta",
    "<LandingFooter",
  ];

  let cursor = -1;
  for (const marker of ordered) {
    const next = page.indexOf(marker);
    assert.ok(next > cursor, marker + " must appear in approved order");
    cursor = next;
  }

  assert.match(page, /export default async function LandingPage\(\)/);
  assert.doesNotMatch(page, /["']use client["']/);
  assert.match(page, /<div className="lp lp-home">/);
  assert.equal(
    [...page.matchAll(/getAppContext\(\)/g)].length,
    1,
    "getAppContext must be awaited exactly once",
  );
  assert.match(page, /const ctx = await getAppContext\(\);/);
  assert.match(page, /const isAuthed = Boolean\(ctx\);/);
  assert.match(page, /<Hero isAuthed=\{isAuthed\} \/>/);
  assert.match(page, /<ClosingCta isAuthed=\{isAuthed\} \/>/);
  assert.match(page, /<Pricing tiers=\{PUBLIC_PLANS\} \/>/);

  assert.match(page, /alternates:\s*\{ canonical: "\/" \}/);
  assert.match(page, /type="application\/ld\+json"/);
  assert.match(page, /"@type": "SoftwareApplication"/);
  assert.match(page, /"@type": "FAQPage"/);
  assert.match(page, /lowPrice: String\(PLANS\.free\.monthly\)/);
  assert.match(page, /highPrice: String\(PLANS\.premium\.monthly\)/);
  assert.match(page, /offerCount: String\(PUBLIC_PLANS\.length\)/);
  assert.match(page, /FAQ_ITEMS\.map\(\(item\) => \(\{/);
  assert.match(page, /name: item\.question/);
  assert.match(page, /text: item\.answer/);

  assert.doesNotMatch(
    page,
    /STATS|TESTIMONIALS|500\+|2\.4M|4\.8\/5|99\.9%|ร้านจริงใช้จริง|ความพึงพอใจ|ร้านอาหาร|คาเฟ่/i,
  );
  assert.match(page, /name: "ขายดี Stock"/);

  const mainStart = page.indexOf("<main>");
  const mainEnd = page.indexOf("</main>");
  const footer = page.indexOf("<LandingFooter");
  assert.ok(mainStart !== -1 && mainEnd > mainStart, "page must render main");
  assert.ok(footer > mainEnd, "LandingFooter must render outside main");
});
