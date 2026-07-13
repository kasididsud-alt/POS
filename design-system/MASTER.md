# ขายดี Stock — Landing Design System

> This file is the source of truth for the public landing experience. If a future
> `design-system/pages/[page-name].md` exists, its page-specific rules override
> this file; otherwise follow this master.

**Direction:** Retail Command Center

**Product:** Thai retail POS and inventory SaaS

**Generated from:** UI/UX Pro Max v2.5.0, with the approved navy/mint/blue brief applied as the authoritative override

**Dependency rule:** Use the existing application stack and assets; add no UI, icon, animation, or font dependency

## Experience principles

- Make the product feel operational, credible, and calm: a control center for a real Thai shop, not a playful consumer app.
- Lead with outcomes for independent retailers: faster checkout, accurate stock, and daily profit visibility.
- Keep every claim demonstrable. Do not invent ratings, testimonials, customer logos, download badges, or social-proof numbers.
- Use editorial retail photography for context and HTML/CSS product surfaces for explainability. Do not place fake floating UI over the photograph.
- Build mobile-first, preserve reading order, and keep the primary task obvious at every breakpoint.

## Color system

Use these semantic tokens inside the landing-page `.lp` scope. Do not introduce competing raw colors in landing components.

```css
.lp {
  --lp-canvas: #f5f8fc;
  --lp-surface: #ffffff;
  --lp-ink: #07182f;
  --lp-night: #06152b;
  --lp-night-soft: #0c2444;
  --lp-mint: #42e6ad;
  --lp-mint-ink: #07543d;
  --lp-blue: #4db8ff;
  --lp-rule: #d9e3ef;
  --lp-muted: #52657b;
  --primary: #087f60;
  --primary-fg: #ffffff;
}
```

| Role | Token | Use |
| --- | --- | --- |
| Page canvas | `--lp-canvas` | Default landing background |
| Raised surface | `--lp-surface` | Cards and light content panels |
| Primary text | `--lp-ink` | Headings and body copy on light surfaces |
| Hero/footer | `--lp-night` | High-contrast dark sections and image overlays |
| Dark surface | `--lp-night-soft` | Nested panels on navy sections |
| Signal accent | `--lp-mint` | Live status, emphasis, and dark-surface highlights |
| Accent text | `--lp-mint-ink` | Text placed on mint fills |
| Information accent | `--lp-blue` | Secondary data and supporting highlights |
| Divider | `--lp-rule` | Borders and separators on light surfaces |
| Secondary text | `--lp-muted` | Supporting copy on light surfaces |
| Primary action | `--primary` | Main CTA on light surfaces |

- Normal text must meet WCAG AA contrast of at least 4.5:1; large text and graphical controls must meet at least 3:1.
- Mint and blue are accents, not body-copy colors on light backgrounds.
- Never communicate state by color alone; pair status color with text or an icon.

## Typography

- Use the existing `var(--font-noto-thai), sans-serif` family for headings, body copy, labels, and numerals.
- Do not add a CSS font import or another font package.
- Body copy starts at `16px`, with `1.5–1.75` line height and a maximum readable measure of `70ch`.
- Use weights 400 for body copy, 500–600 for labels and controls, and 700 for display headings.
- Preserve natural Thai line breaking. Do not force manual line breaks outside the approved hero composition.
- Use tabular numerals for prices, counts, percentages, and ticker metrics.

## Spacing and layout

Use a 4/8px rhythm.

| Token | Value | Typical use |
| --- | --- | --- |
| `--space-xs` | `4px` | Tight optical correction |
| `--space-sm` | `8px` | Inline and icon gaps |
| `--space-md` | `16px` | Compact component padding |
| `--space-lg` | `24px` | Card padding and grouped gaps |
| `--space-xl` | `32px` | Large component gaps |
| `--space-2xl` | `48px` | Section grouping |
| `--space-3xl` | `64px` | Mobile section rhythm |

- Use responsive gutters and one consistent centered content width; never create horizontal page scroll.
- Section padding is `64–80px` on mobile and `80–112px` on desktop.
- Cards may use 12–20px radii, one consistent border, and restrained elevation. Shadow must clarify hierarchy, not decorate every surface.
- Glass treatment is limited to the hero/navigation layer where the opaque navy image gradient preserves text contrast.

## Page pattern

Use this order unless content requirements explicitly change:

1. Sticky, compact navigation
2. Retail Command Center hero with one primary CTA and one subordinate CTA
3. Live operational ticker
4. Three retailer outcomes
5. Four-step workflow
6. POS product showcase built with HTML/CSS
7. Six product-capability cards
8. Supported store types
9. Plans/pricing
10. Semantic FAQ
11. Dark closing CTA and footer

Each section gets one clear heading, concise supporting copy, and a single purpose. The hero is the only above-the-fold focal point.

## Selected hero asset

- Local URL: `/images/landing/retail-command-center.png`
- Intrinsic dimensions: `1672 × 941`
- Role: atmospheric hero background; the real employee, POS terminal, and stocked minimart establish credibility.
- Composition: preserve the employee and terminal on the right and the clean negative space on the left.
- Render above the fold with `next/image`, reserved dimensions/fill, `preload`, and responsive `sizes="100vw"`.
- The image is decorative behind equivalent page copy, so use `alt=""`. Do not repeat surrounding copy as alt text.
- Keep an opaque navy gradient between the photograph and text. Reposition/crop at narrow breakpoints instead of covering the employee’s face or POS with cards.

## Components and interaction

### Buttons and links

- Provide one visually dominant CTA per section. Secondary actions use outline or text treatment.
- Interactive targets are at least `44 × 44px`, separated by at least `8px`, and use semantic links/buttons.
- Show distinct hover, active, and disabled states without changing layout bounds.
- Every keyboard-focusable element uses a visible 2–4px `:focus-visible` ring with sufficient contrast.

### Cards and data surfaces

- Light cards use `--lp-surface`, `--lp-rule`, and `--lp-ink`; dark cards use `--lp-night-soft` with high-contrast text.
- Use one SVG icon language with consistent stroke and sizing. Do not use emoji as structural icons.
- Data and product mockups favor legibility over decoration; labels and values must remain readable at 375px.

### Motion and ticker

- Interaction transitions last `150–300ms` and animate only `transform` and `opacity`.
- The ticker pauses on hover and keyboard focus.
- Under `prefers-reduced-motion: reduce`, stop continuous motion, show the information statically, and reduce transition duration to effectively instant.
- Do not use scroll-jacking, parallax, or motion that blocks input.

## Responsive and performance rules

- Validate at 375px, 768px, 1024px, and 1440px, plus phone landscape.
- Core content comes first on mobile; secondary decorative material may reflow but must not hide claims or actions.
- Reserve media space to prevent layout shift. Optimize images through Next.js and lazy-load below-fold media.
- Keep the landing page a Server Component by default; introduce client JavaScript only for behavior that cannot be expressed semantically or with CSS.
- No new runtime or styling dependency is allowed for this redesign.

## Anti-patterns

- App-store badges, QR codes, fabricated reviews, ratings, logos, or usage statistics
- Orange or pharmacy-green themes that displace the approved navy/mint/blue palette
- Low-contrast transparent glass across ordinary content sections
- Fake floating dashboards over the retail photograph
- Restaurant/cafe imagery, readable generated text, brands, watermarks, or trademarks in the hero
- Emoji icons, mixed icon families, or raster UI icons
- Hover-only access, invisible focus styles, tiny targets, or color-only state
- Excessive animation, layout-shifting hover effects, parallax, or ignored reduced-motion preferences
- External font imports, new component libraries, or one-off raw colors in landing components

## Pre-delivery checklist

- [ ] Thai copy wraps naturally at mobile and desktop widths.
- [ ] Text contrast, focus rings, semantic headings, and 44px targets pass accessibility review.
- [ ] Keyboard users can reach and understand every action; moving content pauses on focus.
- [ ] Reduced-motion mode removes continuous animation without hiding information.
- [ ] The selected hero image uses the local optimized path and reserves its layout space.
- [ ] No fabricated proof, logo, rating, or unsupported product claim appears.
- [ ] All landing components use the approved tokens and existing dependencies only.
- [ ] No horizontal overflow occurs at 375px or in phone landscape.
