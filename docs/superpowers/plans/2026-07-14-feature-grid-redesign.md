# Feature Grid Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the uneven landing-page Feature Bento with six uniformly structured cards that render as a 3×2 desktop grid, 2×3 tablet grid, and single-column mobile list.

**Architecture:** Keep `FeatureGrid` as a static server-rendered section that maps the existing `FEATURES` data. Remove item-specific width and bottom-alignment branches, then express layout entirely with existing Tailwind utilities; do not add global CSS, client state, dependencies, or new content. Protect the layout contract with the existing source-regression test pattern and verify rendered geometry in the browser.

**Tech Stack:** Next.js 16.2.9 App Router, React, TypeScript, Tailwind CSS utilities, Node.js built-in test runner.

## Global Constraints

- Preserve all six existing feature titles, descriptions, SVG icons, semantic tokens, and DOM order.
- Desktop at `lg` uses 3 columns × 2 rows; tablet at `md` uses 2 columns × 3 rows; mobile uses 1 column.
- No feature may span multiple columns.
- Do not use `min-height: 256px`, `min-h-64`, `h-full`, `mt-auto`, `justify-between`, or an `isWide` branch inside `FeatureGrid`.
- Card content order is icon, heading, description, all top-aligned.
- Card padding is 24px on mobile and 28px from `sm` upward; the first element must begin no more than 32px from the card top.
- Keep cards static and retain the existing `.lp-card` surface, border, radius, shadow, and color tokens.
- Do not add copy, claims, CTA elements, dependencies, client-side JavaScript, or changes outside this section and its regression test.
- Preserve unrelated uncommitted changes already present in `components/landing/LandingSections.tsx` and `test/landing-source.test.ts`, especially the `AuthPrimaryCta` work.

---

### Task 1: Implement and verify the uniform feature grid

**Files:**
- Modify: `test/landing-source.test.ts:375-380`
- Modify: `components/landing/LandingSections.tsx:97-152`
- Reference: `docs/superpowers/specs/2026-07-14-feature-grid-redesign-design.md`
- Reference: `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`

**Interfaces:**
- Consumes: `FEATURES` from `components/landing/content.ts` and `LandingIcon` from `components/landing/LandingIcon.tsx`.
- Produces: the existing `FeatureGrid(): JSX.Element` export with no signature change.
- Preserves: `section#features`, `aria-labelledby="features-title"`, six semantic `article` elements, six `h3` headings, and decorative `aria-hidden="true"` icon wrappers.

- [ ] **Step 1: Replace the old Bento regression with a failing uniform-grid contract**

Replace the test at `test/landing-source.test.ts:375-380` with:

```ts
test("Feature grid uses uniform top-aligned cards", async () => {
  const source = await read("components/landing/LandingSections.tsx");
  const featureGrid = exportedFunctionSource(source, "FeatureGrid");
  const grid = featureGrid.match(
    /<div className="mt-10 grid[^"]*">/,
  )?.[0];

  assert.ok(grid, "FeatureGrid must render its responsive grid container");
  assert.match(grid, /\bmd:grid-cols-2\b/);
  assert.match(grid, /\blg:grid-cols-3\b/);
  assert.match(
    featureGrid,
    /className="lp-card overflow-hidden p-6 sm:p-7"/,
  );
  assert.match(featureGrid, /className="flex flex-col gap-6"/);
  assert.doesNotMatch(
    featureGrid,
    /\b(?:isWide|min-h-64|h-full|mt-auto|justify-between|col-span-\d+)\b/,
  );
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --test --experimental-strip-types --test-name-pattern='Feature grid uses uniform top-aligned cards' test/landing-source.test.ts
```

Expected: FAIL because the current component contains `lg:grid-cols-4`, `isWide`, `min-h-64`, `h-full`, `mt-auto`, and `lg:col-span-2`.

- [ ] **Step 3: Implement the minimal uniform grid**

Replace only the feature-grid mapping block at `components/landing/LandingSections.tsx:119-150`; preserve every unrelated diff in the file:

```tsx
<div className="mt-10 grid gap-5 md:grid-cols-2 lg:mt-12 lg:grid-cols-3">
  {FEATURES.map((feature) => (
    <article
      key={feature.id}
      className="lp-card overflow-hidden p-6 sm:p-7"
    >
      <div className="flex flex-col gap-6">
        <span className="lp-chip lp-chip-lg shrink-0" aria-hidden="true">
          <LandingIcon name={feature.icon} className="h-7 w-7" />
        </span>
        <div>
          <h3 className="text-xl font-bold text-[var(--lp-ink)] sm:text-2xl">
            {feature.title}
          </h3>
          <p className="mt-3 max-w-[68ch] text-base leading-7 text-[var(--lp-muted)]">
            {feature.description}
          </p>
        </div>
      </div>
    </article>
  ))}
</div>
```

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run:

```bash
node --test --experimental-strip-types --test-name-pattern='Feature grid uses uniform top-aligned cards' test/landing-source.test.ts
```

Expected: 1 matching test passes and 0 fail.

- [ ] **Step 5: Run focused static verification**

Run:

```bash
node --test --experimental-strip-types test/landing-*.test.ts
npx eslint components/landing/LandingSections.tsx test/landing-source.test.ts
npx tsc --noEmit --incremental false
```

Expected: all landing tests pass; ESLint and TypeScript exit 0.

- [ ] **Step 6: Verify rendered geometry and accessibility in the browser**

With the dev server at `http://localhost:3020/#features`, inspect widths 390px, 768px, and 1440px. At each width, read the six `#features article` rectangles and confirm:

- 390px has 1 unique card x-position and 6 rows.
- 768px has 2 unique card x-positions and 3 rows.
- 1440px has 3 unique card x-positions and 2 rows.
- Every first icon begins 24–32px below the card top.
- Cards in the same row have equal heights; mobile card height follows content.
- All six headings and descriptions are visible without clipping or ellipsis.
- `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
- The section DOM snapshot still exposes one `h2`, six `article` elements, and six `h3` headings in `FEATURES` order.
- Browser console contains no new warning or error.

Expected: all conditions hold at all three widths. If a condition fails, adjust only the utility classes in the FeatureGrid mapping, add a regression assertion for the failure, and repeat RED → GREEN before continuing.

- [ ] **Step 7: Run full regression and production build**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: 0 failed tests; database-dependent tests may remain skipped when `DATABASE_URL` is unavailable; production build exits 0; diff check is clean.

- [ ] **Step 8: Commit only the FeatureGrid hunks**

Because both target files already contain unrelated user work, stage only the hunk replacing the old FeatureGrid test and the hunk simplifying `FeatureGrid`. Do not stage the `AuthPrimaryCta`, static landing, or other concurrent changes.

Verify the staged diff contains only:

```bash
git diff --cached -- components/landing/LandingSections.tsx test/landing-source.test.ts
```

Then commit:

```bash
git commit -m "fix: simplify landing feature grid"
```

Expected: the commit contains only the uniform-grid implementation and its regression test; all unrelated working-tree changes remain unstaged.
