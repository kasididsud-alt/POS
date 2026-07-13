# ขายดี Stock Index Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** สร้างหน้า index ใหม่สำหรับ “ขายดี Stock” ให้เป็น landing page ระบบ POS และคลังสินค้าสำหรับร้านค้าปลีกสมัยใหม่ พร้อมภาพ Hero จาก ImageGen และ Live Retail Ticker ที่อ่านง่าย

**Architecture:** คง app/page.tsx เป็น Server Component และใช้เป็นตัวประกอบ section เท่านั้น ส่วน UI แยกตามหน้าที่ไว้ใน components/landing/ โดยมี content.ts เป็นแหล่งข้อความกลาง Hero และ section แบบ static อยู่ฝั่ง server ส่วน Pricing เป็น Client Component ขนาดเล็กเพียงจุดเดียว ภาพ Hero เป็น local static asset ผ่าน next/image และ Ticker ใช้ CSS animation โดยไม่เพิ่ม JavaScript ฝั่ง client

**Tech Stack:** Next.js 16.2.9 App Router, React 19.2.4, TypeScript 5, Tailwind CSS 4, CSS, node:test, ImageGen built-in

## Global Constraints

- ชื่อแบรนด์ต้องเป็น “ขายดี Stock”
- กลุ่มเป้าหมายคือร้านค้าปลีกที่ขายสินค้า ไม่ใช่ร้านอาหารหรือคาเฟ่
- ห้ามเปลี่ยน backend, database schema, authentication หรือ logic ของ POS
- ห้ามเพิ่ม runtime dependency หรือ component library ใหม่
- ห้ามสร้างตัวเลขลูกค้า รีวิว หรือ social proof ที่ตรวจสอบไม่ได้
- ใช้สี Retail Command Center: น้ำเงินเข้ม + มิ้นต์ + ฟ้าสว่าง + พื้นขาวอมเทา
- รองรับ 375px, 768px และ 1440px โดยไม่มี horizontal scroll
- ปุ่มและลิงก์มีพื้นที่กดอย่างน้อย 44×44px; body copy หลักบนมือถือไม่น้อยกว่า 16px
- สีข้อความปกติต้องมี contrast อย่างน้อย 4.5:1 และ interactive element ทุกตัวมี visible focus ring
- Animation ต้องใช้ transform/opacity และรองรับ prefers-reduced-motion
- อ่านและปฏิบัติตาม node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md, 11-css.md และ 12-images.md
- เวิร์กทรีมีการแก้ไขของผู้ใช้อยู่แล้ว ต้องตรวจ git diff ก่อนและหลังทุก task ห้ามลบหรือ stage ไฟล์นอกขอบเขต

---

## File Map

**Create**

- design-system/MASTER.md — design tokens และกฎ visual จาก ui-ux-pro-max
- public/images/landing/retail-command-center.png — ภาพ Hero ที่เลือกจาก ImageGen
- components/landing/content.ts — typed copy/data ของหน้า
- components/landing/LandingIcon.tsx — SVG icon renderer ชุดเดียว
- components/landing/LiveTicker.tsx — Ticker แบบ CSS-only
- components/landing/Hero.tsx — Navigation, Hero, glass card และ stat cards
- components/landing/ProductShowcase.tsx — mockup POS ที่สร้างด้วย HTML/CSS
- components/landing/LandingSections.tsx — outcomes, workflow, features, store fit, FAQ, closing CTA และ footer
- test/landing-asset.test.ts — contract ของไฟล์ภาพ
- test/landing-content.test.ts — contract ของข้อความและ claims
- test/landing-source.test.ts — integration contract ของ component, accessibility และ motion

**Modify**

- app/page.tsx — Server Component ที่ประกอบทุก section และ JSON-LD
- app/globals.css — เปลี่ยนเฉพาะ landing scope .lp และคงกฎ auth/print ที่มีอยู่
- components/landing/Pricing.tsx — รับข้อมูลราคาเป็น props และปรับ visual ให้ตรง theme ใหม่
- lib/plans.ts — export PUBLIC_PLANS แบบ serializable จาก PLANS
- app/pricing/page.tsx — ส่ง PUBLIC_PLANS เข้า Pricing
- components/landing/LogoMark.tsx — เปลี่ยน token สีโดยคง public interface เดิม

---

### Task 1: Lock the design system and persist the selected ImageGen asset

**Files:**

- Create: design-system/MASTER.md
- Create: public/images/landing/retail-command-center.png
- Create: test/landing-asset.test.ts

**Interfaces:**

- Consumes: ImageGen source /Users/kasidid/.codex/generated_images/019f5c39-16e9-74a3-96bb-c0dad008d7d2/exec-9709d81f-8b9e-454f-ac26-2fdab65a2c14.png
- Produces: local image URL /images/landing/retail-command-center.png with intrinsic size 1672×941

- [ ] **Step 1: Write the failing asset contract**

Create test/landing-asset.test.ts:

~~~ts
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
~~~

- [ ] **Step 2: Run the asset contract and verify failure**

Run:

    node --test --experimental-strip-types test/landing-asset.test.ts

Expected: FAIL with ENOENT for public/images/landing/retail-command-center.png.

- [ ] **Step 3: Generate and persist the UI design system**

Run:

    python3 /Users/kasidid/.codex/skills/ui-ux-pro-max/scripts/search.py "retail POS inventory SaaS professional modern Thai store" --design-system --persist -p "ขายดี Stock"
    python3 /Users/kasidid/.codex/skills/ui-ux-pro-max/scripts/search.py "marquee accessibility focus reduced motion responsive landing" --domain ux
    python3 /Users/kasidid/.codex/skills/ui-ux-pro-max/scripts/search.py "Next.js image performance responsive landing" --domain react

Expected: design-system/MASTER.md exists. Keep the approved spec authoritative if the generated recommendation conflicts with navy/mint/blue, Thai readability, or the no-new-dependency constraint.

- [ ] **Step 4: Copy the selected generated image into the project**

Run:

    mkdir -p public/images/landing
    cp /Users/kasidid/.codex/generated_images/019f5c39-16e9-74a3-96bb-c0dad008d7d2/exec-9709d81f-8b9e-454f-ac26-2fdab65a2c14.png public/images/landing/retail-command-center.png

The final prompt associated with this asset is:

~~~text
Use case: photorealistic-natural
Asset type: landing page hero background concept for a real retail POS and inventory SaaS
Primary request: Retail Command Center concept — a modern independent Thai minimart at the checkout counter, a focused retail employee naturally using a sleek touchscreen POS terminal, well-organized shelves of packaged everyday goods clearly visible, professional and credible
Scene/backdrop: contemporary compact neighborhood retail store, clean and operational, no restaurant or cafe elements
Style/medium: premium photorealistic editorial commercial photography, believable real-world textures, not a UI mockup
Composition/framing: wide 16:9 landscape hero composition, employee and POS positioned toward the right half, generous clean negative space on the left for website headline and buttons
Lighting/mood: controlled cinematic daylight with deep navy shadows and subtle mint highlights
Constraints: no readable text, no logos, no trademarks, no watermark, no fake floating UI, no restaurant food, no cafe setting
~~~

- [ ] **Step 5: Run the asset contract and verify pass**

Run:

    node --test --experimental-strip-types test/landing-asset.test.ts

Expected: 1 test passes.

- [ ] **Step 6: Commit isolated new files**

Run:

    git add design-system/MASTER.md public/images/landing/retail-command-center.png test/landing-asset.test.ts
    git diff --cached --check
    git commit -m "feat: add retail landing visual system"

Expected: only the three listed paths are committed.

---

### Task 2: Create the typed landing content model

**Files:**

- Create: components/landing/content.ts
- Create: test/landing-content.test.ts

**Interfaces:**

- Produces: IconName, TICKER_ITEMS, OUTCOMES, WORKFLOW_STEPS, FEATURES, STORE_TYPES, FAQ_ITEMS
- All exported collections are readonly and use stable id fields

- [ ] **Step 1: Write the failing content contract**

Create test/landing-content.test.ts:

~~~ts
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
~~~

- [ ] **Step 2: Run the content contract and verify failure**

Run:

    node --test --experimental-strip-types test/landing-content.test.ts

Expected: FAIL because components/landing/content.ts does not exist.

- [ ] **Step 3: Implement the content module**

Create components/landing/content.ts with these exact public shapes and copy:

~~~ts
export type IconName =
  | "scan"
  | "inventory"
  | "chart"
  | "branches"
  | "users"
  | "shield"
  | "receipt"
  | "arrow"
  | "check"
  | "alert";

type CopyItem = Readonly<{
  id: string;
  title: string;
  description: string;
  icon: IconName;
}>;

export const TICKER_ITEMS = [
  { id: "sales", label: "ยอดขายวันนี้", value: "฿12,450" },
  { id: "bill", label: "บิลล่าสุด", value: "#087" },
  { id: "stock", label: "สต็อกใกล้หมด", value: "4 รายการ" },
  { id: "profit", label: "กำไรวันนี้", value: "+18%" },
  { id: "transfer", label: "รับโอนเข้าคลัง", value: "12 ชิ้น" },
] as const;

export const OUTCOMES = [
  { id: "fast", title: "ขายได้เร็วขึ้น", description: "สแกนสินค้า คิดเงิน และออกใบเสร็จในหน้าจอเดียว", icon: "scan" },
  { id: "accurate", title: "สต็อกตรงทุกบิล", description: "ตัดสต็อกทันที พร้อมประวัติรับเข้า โอน และตรวจนับ", icon: "inventory" },
  { id: "profit", title: "รู้กำไรทุกวัน", description: "เห็นยอดขาย ต้นทุน และกำไรจากข้อมูลจริงของร้าน", icon: "chart" },
] as const satisfies readonly CopyItem[];

export const WORKFLOW_STEPS = [
  { id: "setup", step: "01", title: "ตั้งสินค้า", description: "เพิ่มสินค้า ราคา บาร์โค้ด และสต็อกตั้งต้น" },
  { id: "sell", step: "02", title: "เปิดขาย", description: "เลือกหรือสแกนสินค้า แล้วรับเงินสดหรือพร้อมเพย์" },
  { id: "sync", step: "03", title: "สต็อกตัดเอง", description: "ทุกบิลอัปเดตจำนวนคงเหลือและต้นทุนอัตโนมัติ" },
  { id: "report", step: "04", title: "ดูรายงาน", description: "เช็กยอดขาย กำไร และสินค้าที่ต้องเติมได้ทันที" },
] as const;

export const FEATURES = [
  { id: "inventory", title: "คลังสินค้าครบวงจร", description: "รับเข้า เบิก โอน ตรวจนับ ล็อต และวันหมดอายุ", icon: "inventory" },
  { id: "branches", title: "หลายสาขาในที่เดียว", description: "ดูสต็อกแยกสาขาและโอนสินค้าได้อย่างมีประวัติ", icon: "branches" },
  { id: "members", title: "ลูกค้าและสมาชิก", description: "เก็บประวัติซื้อ แต้ม โปรโมชั่น และข้อมูลติดต่อ", icon: "users" },
  { id: "receivables", title: "ขายเชื่อและลูกหนี้", description: "ติดตามยอดค้าง รับชำระ และดูสถานะลูกหนี้เป็นระบบ", icon: "receipt" },
  { id: "reports", title: "รายงานที่ใช้ตัดสินใจ", description: "ยอดขาย กำไร สินค้าขายดี และสต็อกใกล้หมด", icon: "chart" },
  { id: "permissions", title: "สิทธิ์พนักงานชัดเจน", description: "แยกเจ้าของ ผู้จัดการ และแคชเชียร์ พร้อม audit log", icon: "shield" },
] as const satisfies readonly CopyItem[];

export const STORE_TYPES = [
  { id: "minimart", title: "มินิมาร์ท", description: "ขายเร็วด้วยบาร์โค้ดและเตือนของใกล้หมด" },
  { id: "wholesale", title: "ร้านขายส่ง", description: "ดูต้นทุน ลูกหนี้ และจำนวนสินค้าหลายรายการ" },
  { id: "beauty", title: "ร้านเครื่องสำอาง", description: "จัดการล็อต สมาชิก โปรโมชั่น และหลายราคา" },
  { id: "parts", title: "ร้านอะไหล่", description: "ค้นหาสินค้าไว แยกตำแหน่งเก็บ และตรวจนับง่าย" },
] as const;

export const FAQ_ITEMS = [
  { id: "free", question: "เริ่มใช้ฟรีได้ไหม?", answer: "ได้ แพ็กเริ่มต้นใช้ฟรีและไม่ต้องใช้บัตรเครดิต ส่วนแพ็กแบบชำระเงินทดลองใช้ได้ 14 วัน" },
  { id: "device", question: "ต้องซื้อเครื่องใหม่หรือไม่?", answer: "ไม่ต้อง ใช้ผ่านเบราว์เซอร์บนมือถือ แท็บเล็ต หรือคอมพิวเตอร์ และรองรับเครื่องสแกนบาร์โค้ดทั่วไป" },
  { id: "payment", question: "รับชำระเงินแบบไหนได้บ้าง?", answer: "รองรับเงินสดและสร้าง QR พร้อมเพย์ระบุยอดอัตโนมัติ โดยร้านเป็นผู้ยืนยันการรับเงิน" },
  { id: "security", question: "ข้อมูลของแต่ละร้านแยกจากกันไหม?", answer: "แยกข้อมูลตามร้านและสาขาฝั่งเซิร์ฟเวอร์ พร้อมสิทธิ์ผู้ใช้และบันทึกการทำงาน" },
] as const;
~~~

- [ ] **Step 4: Run the content contract and verify pass**

Run:

    node --test --experimental-strip-types test/landing-content.test.ts

Expected: 3 tests pass.

- [ ] **Step 5: Commit the content slice**

Run:

    git add components/landing/content.ts test/landing-content.test.ts
    git diff --cached --check
    git commit -m "feat: define retail landing content"

---

### Task 3: Build the Hero, SVG icon system, and accessible Live Retail Ticker

**Files:**

- Create: components/landing/LandingIcon.tsx
- Create: components/landing/LiveTicker.tsx
- Create: components/landing/Hero.tsx
- Create: test/landing-source.test.ts
- Modify: components/landing/LogoMark.tsx
- Modify: app/globals.css

**Interfaces:**

- Hero props: Readonly<{ isAuthed: boolean }>
- LandingIcon props: Readonly<{ name: IconName; className?: string }>
- LiveTicker consumes TICKER_ITEMS and exposes no props

- [ ] **Step 1: Write the failing Hero and Ticker source contract**

Create test/landing-source.test.ts:

~~~ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) =>
  readFile(new URL("../" + path, import.meta.url), "utf8");

test("Hero uses the selected local image accessibly", async () => {
  const hero = await read("components/landing/Hero.tsx");
  assert.match(hero, /retail-command-center\.png/);
  assert.match(hero, /alt=""/);
  assert.match(hero, /priority/);
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
~~~

- [ ] **Step 2: Run the source contract and verify failure**

Run:

    node --test --experimental-strip-types test/landing-source.test.ts

Expected: FAIL because Hero.tsx and LiveTicker.tsx do not exist.

- [ ] **Step 3: Implement LandingIcon**

Create components/landing/LandingIcon.tsx. Use one 24px outline family, strokeWidth 1.8, aria-hidden, and a record keyed by every IconName from content.ts. Paths must represent scan corners, box/inventory, chart bars, branches, users, shield/check, receipt, right arrow, check, and alert. Export only:

~~~tsx
import type { IconName } from "./content";

export default function LandingIcon({
  name,
  className = "h-6 w-6",
}: Readonly<{ name: IconName; className?: string }>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
~~~

Do not use emoji or mix filled and outline icons.

- [ ] **Step 4: Implement LiveTicker**

Create components/landing/LiveTicker.tsx:

~~~tsx
import { TICKER_ITEMS } from "./content";

function TickerGroup({ duplicate = false }: Readonly<{ duplicate?: boolean }>) {
  return (
    <div className="lp-ticker-group" aria-hidden={duplicate ? "true" : undefined}>
      {TICKER_ITEMS.map((item) => (
        <span className="lp-ticker-item" key={item.id}>
          <span className="lp-ticker-dot" aria-hidden="true" />
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </span>
      ))}
    </div>
  );
}

export default function LiveTicker() {
  return (
    <div
      className="lp-ticker"
      role="region"
      aria-label="ตัวอย่างข้อมูลสดจากระบบขายหน้าร้าน"
      tabIndex={0}
    >
      <div className="lp-ticker-track">
        <TickerGroup />
        <TickerGroup duplicate />
      </div>
    </div>
  );
}
~~~

- [ ] **Step 5: Implement Hero**

Create components/landing/Hero.tsx with:

- a sticky header containing LogoMark, links to #product, #features, /pricing, /login, and the auth-aware /dashboard or /signup CTA
- next/image using src /images/landing/retail-command-center.png, fill, priority, sizes="100vw", alt="", object-cover, and a right-biased object position on mobile
- an opaque navy gradient between image and text
- a glass panel containing eyebrow, approved H1, supporting copy, primary and secondary CTA
- three compact stat cards that never cover the employee face or POS
- LiveTicker as the final child of the Hero section

Use this copy exactly:

~~~tsx
<h1>
  ขายคล่อง
  <span>สต็อกตรง</span>
  รู้กำไรทุกวัน
</h1>
<p>
  POS + คลังสินค้า สำหรับร้านขายของที่อยากทำงานเร็วขึ้น
  ตั้งแต่หน้าร้านจนถึงหลังร้าน จบในระบบเดียว
</p>
~~~

The stat cards are labelled “ยอดขายวันนี้”, “บิลล่าสุด”, and “สต็อกใกล้หมด”. Mark the decorative sparkline SVG aria-hidden.

- [ ] **Step 6: Replace only the landing theme block in globals.css**

Keep root tokens, utility components, .lp-auth rules, and print rules intact. Replace the old green/gold landing selectors with:

~~~css
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
  --paper: var(--lp-canvas);
  --paper-2: #edf3f9;
  --ink: var(--lp-ink);
  --night: var(--lp-night);
  --green: #087f60;
  --green-d: #06684f;
  --gold: var(--lp-mint);
  --gold-d: var(--lp-mint-ink);
  --rule: var(--lp-rule);
  --muted2: var(--lp-muted);
  --primary: #087f60;
  --primary-fg: #ffffff;
  --border: var(--lp-rule);
  --muted: var(--lp-muted);
  min-height: 100%;
  overflow-x: clip;
  background: var(--lp-canvas);
  color: var(--lp-ink);
  font-family: var(--font-noto-thai), sans-serif;
}

.lp-focus:focus-visible,
.lp a:focus-visible,
.lp button:focus-visible,
.lp summary:focus-visible,
.lp-ticker:focus-visible {
  outline: 3px solid var(--lp-blue);
  outline-offset: 3px;
}

.lp-hero {
  position: relative;
  min-height: min(860px, 100dvh);
  overflow: hidden;
  color: white;
  background: var(--lp-night);
}

.lp-glass-panel {
  background: rgba(7, 24, 47, 0.74);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 32px 80px -40px rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(18px);
}

.lp-ticker {
  position: relative;
  z-index: 5;
  overflow: hidden;
  background: #041226;
  border-block: 1px solid rgba(77, 184, 255, 0.24);
}

.lp-ticker-track {
  display: flex;
  width: max-content;
  animation: lp-retail-ticker 34s linear infinite;
  will-change: transform;
}

.lp-ticker-group {
  display: flex;
  flex: none;
  align-items: center;
  padding-block: 13px;
}

.lp-ticker-item {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding-inline: 24px;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.82);
  font-size: 14px;
  line-height: 1.5;
}

.lp-ticker-item strong {
  color: var(--lp-mint);
  font-variant-numeric: tabular-nums;
}

.lp-ticker-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--lp-mint);
  box-shadow: 0 0 0 4px rgba(66, 230, 173, 0.11);
}

.lp-ticker:hover .lp-ticker-track,
.lp-ticker:focus-within .lp-ticker-track {
  animation-play-state: paused;
}

@keyframes lp-retail-ticker {
  to { transform: translateX(-50%); }
}

@media (max-width: 767px) {
  .lp-ticker-track { animation-duration: 42s; }
  .lp-ticker-item { padding-inline: 18px; font-size: 14px; }
}

@media (prefers-reduced-motion: reduce) {
  .lp-ticker { overflow: visible; }
  .lp-ticker-track { width: auto; animation: none; }
  .lp-ticker-group { flex-wrap: wrap; justify-content: center; }
  .lp-ticker-group[aria-hidden="true"] { display: none; }
  .lp-card,
  .lp a,
  .lp button { scroll-behavior: auto; transition-duration: 0.01ms !important; }
}
~~~

Add the approved button, card, section eyebrow, responsive Hero, and stat-card selectors in the same .lp scope using these tokens. Do not alter selectors used by app routes outside .lp.

- [ ] **Step 7: Update LogoMark without changing its API**

Keep LogoMark({ className = "h-9 w-9" }) and replace green/gold fallback values with navy/mint values. Preserve existing caller compatibility.

- [ ] **Step 8: Run contract, lint touched files, and verify pass**

Run:

    node --test --experimental-strip-types test/landing-source.test.ts
    npx eslint components/landing/Hero.tsx components/landing/LiveTicker.tsx components/landing/LandingIcon.tsx components/landing/LogoMark.tsx

Expected: 2 tests pass and ESLint exits 0.

- [ ] **Step 9: Review the dirty diff before staging**

Run:

    git diff -- components/landing/LogoMark.tsx app/globals.css

Preserve the pre-existing .lp-auth font rule and the shared token overrides already in app/globals.css. Do not stage app/globals.css in an isolated commit unless its pre-existing user changes can be separated safely.

---

### Task 4: Build the code-native POS Product Showcase

**Files:**

- Create: components/landing/ProductShowcase.tsx
- Modify: test/landing-source.test.ts

**Interfaces:**

- ProductShowcase has no props and renders section id="product"
- The mockup is static, semantic, and uses no client-side state

- [ ] **Step 1: Add a failing Product Showcase contract**

Append:

~~~ts
test("Product Showcase represents a real retail checkout", async () => {
  const source = await read("components/landing/ProductShowcase.tsx");
  assert.match(source, /id="product"/);
  assert.match(source, /ตะกร้าสินค้า/);
  assert.match(source, /พร้อมเพย์/);
  assert.match(source, /เก็บเงิน ฿175/);
  assert.doesNotMatch(source, /ร้านอาหาร|คาเฟ่/);
});
~~~

- [ ] **Step 2: Run and verify failure**

Run:

    node --test --experimental-strip-types test/landing-source.test.ts

Expected: the new test fails because ProductShowcase.tsx does not exist.

- [ ] **Step 3: Implement ProductShowcase**

Build a two-column section:

- left column: eyebrow “ระบบจริงที่หน้าร้าน”, H2 “คิดเงินไว ทุกอย่างอัปเดตต่อให้เอง”, three check rows for barcode, PromptPay, and stock deduction
- right column: desktop POS window with search bar, six product cards, cart rows, subtotal, discount, total ฿175, cash/PromptPay methods, and CTA “เก็บเงิน ฿175”
- a small “สต็อกตัดแล้ว” confirmation card anchored inside the frame

Use native button elements with type="button" and disabled for demo-only controls, or use non-interactive div elements. Never render a clickable-looking control that does nothing.

- [ ] **Step 4: Run test and lint**

Run:

    node --test --experimental-strip-types test/landing-source.test.ts
    npx eslint components/landing/ProductShowcase.tsx

Expected: all source tests pass and ESLint exits 0.

- [ ] **Step 5: Commit the isolated component**

Run:

    git add components/landing/ProductShowcase.tsx test/landing-source.test.ts
    git diff --cached --check
    git commit -m "feat: add POS product showcase"

---

### Task 5: Build outcome, workflow, feature, store-fit, FAQ, CTA, and footer sections

**Files:**

- Create: components/landing/LandingSections.tsx
- Modify: test/landing-source.test.ts

**Interfaces:**

- Exports named Server Components: Outcomes, RetailWorkflow, FeatureGrid, StoreFit, LandingFaq, ClosingCta, LandingFooter
- ClosingCta props: Readonly<{ isAuthed: boolean }>

- [ ] **Step 1: Add a failing section-order and semantics contract**

Append:

~~~ts
test("landing sections expose the approved conversion sequence", async () => {
  const source = await read("components/landing/LandingSections.tsx");
  for (const exportName of [
    "Outcomes",
    "RetailWorkflow",
    "FeatureGrid",
    "StoreFit",
    "LandingFaq",
    "ClosingCta",
    "LandingFooter",
  ]) {
    assert.match(source, new RegExp("export function " + exportName));
  }
  assert.match(source, /id="features"/);
  assert.match(source, /<details/);
  assert.match(source, /<summary/);
});
~~~

- [ ] **Step 2: Run and verify failure**

Run:

    node --test --experimental-strip-types test/landing-source.test.ts

Expected: FAIL because LandingSections.tsx does not exist.

- [ ] **Step 3: Implement the named sections**

Create components/landing/LandingSections.tsx and map only the typed arrays from content.ts:

- Outcomes: three equal cards with icon, title, description
- RetailWorkflow: four numbered steps connected by a line on desktop and stacked on mobile
- FeatureGrid: six bento cards; inventory and reports receive the two wider placements
- StoreFit: four store-type cards with descriptive copy and no fabricated customer logos
- LandingFaq: semantic details/summary using FAQ_ITEMS
- ClosingCta: dark navy panel with auth-aware /dashboard or /signup CTA and /pricing secondary link
- LandingFooter: LogoMark, short brand statement, product links, policy links, current year

Every section gets one H2, body copy width no wider than 70 characters, and vertical padding of 80–112px desktop / 64–80px mobile.

- [ ] **Step 4: Run source tests and lint**

Run:

    node --test --experimental-strip-types test/landing-source.test.ts
    npx eslint components/landing/LandingSections.tsx

Expected: all tests pass and ESLint exits 0.

- [ ] **Step 5: Commit the isolated section file**

Run:

    git add components/landing/LandingSections.tsx test/landing-source.test.ts
    git diff --cached --check
    git commit -m "feat: add retail landing sections"

---

### Task 6: Source pricing cards from lib/plans.ts and restyle them

**Files:**

- Modify: lib/plans.ts
- Modify: components/landing/Pricing.tsx
- Modify: app/pricing/page.tsx
- Modify: test/landing-source.test.ts

**Interfaces:**

- Produces PublicPlanDef and PUBLIC_PLANS from lib/plans.ts
- Pricing props: Readonly<{ tiers: readonly PublicPlanDef[] }>
- PUBLIC_PLANS must contain only JSON-serializable fields; do not include Infinity limits

- [ ] **Step 1: Add the failing public-pricing source contract**

Append to test/landing-source.test.ts:

~~~ts
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
~~~

- [ ] **Step 2: Run and verify failure**

Run:

    node --test --experimental-strip-types test/landing-source.test.ts

Expected: FAIL because lib/plans.ts does not export PUBLIC_PLANS and Pricing does not accept tiers.

- [ ] **Step 3: Add a serializable public projection**

Append to lib/plans.ts:

~~~ts
export type PublicPlanDef = Pick<
  PlanDef,
  "id" | "name" | "tagline" | "monthly" | "yearly" | "features" | "highlight"
>;

const PUBLIC_PLAN_IDS = ["free", "pro", "premium"] as const;

export const PUBLIC_PLANS: readonly PublicPlanDef[] = PUBLIC_PLAN_IDS.map((id) => {
  const plan = PLANS[id];
  return {
    id: plan.id,
    name: plan.name,
    tagline: plan.tagline,
    monthly: plan.monthly,
    yearly: plan.yearly,
    features: plan.features,
    highlight: plan.highlight,
  };
});
~~~

- [ ] **Step 4: Convert Pricing to prop-driven data**

In components/landing/Pricing.tsx:

- remove the local Tier type and TIERS constant
- add type-only import of PublicPlanDef
- accept tiers and map them
- keep the monthly/yearly client toggle and role="switch"
- change colors to the navy/mint theme using landing tokens
- keep CTA links to /signup and section id="pricing"

The exported signature is:

~~~tsx
export default function Pricing({
  tiers,
}: Readonly<{ tiers: readonly PublicPlanDef[] }>) {
  const [yearly, setYearly] = useState(false);
  // render tiers using the existing accessible switch pattern
}
~~~

- [ ] **Step 5: Pass PUBLIC_PLANS from both Server Components**

In app/pricing/page.tsx, import PUBLIC_PLANS and render:

~~~tsx
<Pricing tiers={PUBLIC_PLANS} />
~~~

app/page.tsx will use the same call in Task 7.

- [ ] **Step 6: Run tests and lint**

Run:

    node --test --experimental-strip-types test/landing-content.test.ts test/landing-source.test.ts
    npx eslint lib/plans.ts components/landing/Pricing.tsx app/pricing/page.tsx

Expected: all content tests pass and ESLint exits 0.

- [ ] **Step 7: Review scope before committing**

Run:

    git diff -- lib/plans.ts components/landing/Pricing.tsx app/pricing/page.tsx

Commit only if these files had no pre-existing unrelated user edits:

    git add lib/plans.ts components/landing/Pricing.tsx app/pricing/page.tsx test/landing-source.test.ts
    git diff --cached --check
    git commit -m "refactor: source landing prices from plan definitions"

---

### Task 7: Assemble the Server Component page and preserve SEO/auth behavior

**Files:**

- Modify: app/page.tsx
- Modify: app/globals.css
- Modify: test/landing-source.test.ts

**Interfaces:**

- Consumes: getAppContext(), PLANS, PUBLIC_PLANS, all landing components
- Preserves canonical "/", SoftwareApplication JSON-LD, FAQPage JSON-LD, /login, /signup, /dashboard, /pricing

- [ ] **Step 1: Add a failing page assembly contract**

Append:

~~~ts
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
  assert.doesNotMatch(page, /STATS|TESTIMONIALS|500\+|2\.4M|4\.8\/5|99\.9%/);
  assert.match(page, /getAppContext/);
  assert.match(page, /application\/ld\+json/);
});
~~~

- [ ] **Step 2: Run and verify failure**

Run:

    node --test --experimental-strip-types test/landing-source.test.ts

Expected: the page assembly test fails because the old page still contains STATS and TESTIMONIALS.

- [ ] **Step 3: Replace app/page.tsx with the thin orchestrator**

The page must:

1. retain Metadata canonical "/"
2. build JSON_LD from PLANS and FAQ_ITEMS without invented ratings or aggregate usage counts
3. await getAppContext() once and derive isAuthed
4. render the approved component order
5. pass PUBLIC_PLANS to Pricing

Use this component body:

~~~tsx
export default async function LandingPage() {
  const ctx = await getAppContext();
  const isAuthed = Boolean(ctx);

  return (
    <div className="lp">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <Hero isAuthed={isAuthed} />
      <main>
        <Outcomes />
        <ProductShowcase />
        <RetailWorkflow />
        <FeatureGrid />
        <StoreFit />
        <Pricing tiers={PUBLIC_PLANS} />
        <LandingFaq />
        <ClosingCta isAuthed={isAuthed} />
      </main>
      <LandingFooter />
    </div>
  );
}
~~~

- [ ] **Step 4: Finish the landing CSS**

Add section-specific selectors only where Tailwind utilities cannot express:

- glass card fallbacks and backdrop blur
- POS mock frame responsive scaling
- bento hover/focus-within state with no layout shift
- Hero image crop at 375px, 768px, 1440px
- mobile stat-card visibility rules
- section anchor scroll-margin-top

Ensure no selector outside .lp, .lp-auth, or existing print rules changes behavior.

- [ ] **Step 5: Run focused tests and lint**

Run:

    node --test --experimental-strip-types test/landing-asset.test.ts test/landing-content.test.ts test/landing-source.test.ts
    npx eslint app/page.tsx app/globals.css components/landing

Expected: all landing tests pass. ESLint may report that CSS is ignored; it must report no TS/TSX errors.

- [ ] **Step 6: Run the full test suite and production build**

Run:

    npm test
    npm run build

Expected: unit/integration tests pass when the local test database requirement is satisfied; production build exits 0. If integration tests fail solely because the local embedded database is not running, run npm run db in a separate terminal, rerun npm test, and stop that database process after verification.

- [ ] **Step 7: Inspect the final diff without disturbing user changes**

Run:

    git diff --check
    git status --short
    git diff -- app/page.tsx app/globals.css components/landing lib/plans.ts app/pricing/page.tsx

Confirm the pre-existing auth page, POS, sales, API, display-event, and database-module edits are still present and unchanged.

---

### Task 8: Browser visual QA, accessibility pass, and responsive fixes

**Files:**

- Modify only files from Tasks 3–7 when a verified visual defect requires a correction

**Interfaces:**

- Local URL: http://localhost:3020/
- Required viewport widths: 375, 768, 1440

- [ ] **Step 1: Start the development server**

Run:

    npm run dev

Expected: Next.js reports ready on http://localhost:3020.

- [ ] **Step 2: Inspect the desktop page at 1440px**

Use the browser-control skill to open http://localhost:3020/. Capture the whole page and verify:

- image subject and POS are not covered by text/stat cards
- H1 and both CTAs are visible above the fold
- ticker text is crisp, does not overlap, and loops without a gap
- section hierarchy and bento rhythm are consistent
- pricing toggle is operable
- no fake stats or testimonials remain

- [ ] **Step 3: Inspect tablet and mobile**

At 768px and 375px verify:

- no horizontal scrolling
- Hero image crop keeps the employee/POS visible
- H1 wraps naturally without clipping
- minimum 44px targets
- only the intended stat cards remain on mobile
- Product Showcase fits the viewport and cart remains legible
- ticker speed is comfortable and text remains at least 14px

- [ ] **Step 4: Verify keyboard and reduced motion**

Tab from the brand link through navigation, CTAs, ticker, pricing switch, FAQ summaries, and footer links. Focus indicators must remain visible. Emulate prefers-reduced-motion: reduce and confirm the duplicate ticker group is hidden and the remaining items wrap statically.

- [ ] **Step 5: Fix one verified issue at a time and recapture**

For each defect, record viewport + selector + observed failure, patch only the responsible component/CSS, rerun the focused source test and refresh the same viewport. Stop iterating when all checks pass.

- [ ] **Step 6: Final verification**

Run:

    node --test --experimental-strip-types test/landing-asset.test.ts test/landing-content.test.ts test/landing-source.test.ts
    npm run lint
    npm run build
    git diff --check

Expected: all commands exit 0.

- [ ] **Step 7: Final worktree review**

Run:

    git status --short
    git diff --stat

Do not stage or commit pre-existing user changes. If shared dirty files prevent an isolated implementation commit, leave the verified changes unstaged and report that fact explicitly.
