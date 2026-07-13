import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext } from "@/lib/auth";
import { PLANS, PUBLIC_PLANS } from "@/lib/plans";
import Pricing from "@/components/landing/Pricing";

export const metadata: Metadata = {
  // หน้าแรกคือ canonical ของตัวเอง (ไม่ให้หน้าอื่น inherit ค่านี้)
  alternates: { canonical: "/" },
};

/* ---------- ไอคอนเส้น (แทน emoji) ---------- */
const ICON_PATHS: Record<string, React.ReactNode> = {
  scan: (
    <>
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M8 8v8" />
      <path d="M12 8v8" />
      <path d="M16 8v5" />
    </>
  ),
  box: (
    <>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M7 16v-5" />
      <path d="M12 16V8" />
      <path d="M17 16v-3" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  branch: (
    <>
      <path d="M3 22h18" />
      <path d="M6 22V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v17" />
      <path d="M12 22V9a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v13" />
      <path d="M9 8h.01M9 12h.01M9 16h.01M15 12h.01M15 16h.01" />
    </>
  ),
  shield: (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  coins: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="m16.71 13.88.7.71-2.82 2.82" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  heart: (
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  ),
};

function Icon({ name, className = "h-6 w-6" }: { name: string; className?: string }) {
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

/* ---------- เนื้อหา ---------- */
const LED_ITEMS = [
  "ยอดขายวันนี้ ฿12,450",
  "บิล #087 · ฿245 · พร้อมเพย์",
  "กำไรวันนี้ ฿3,980",
  "สต็อกใกล้หมด 4 รายการ",
  "สาขา 2 รับโอนสินค้า 12 ชิ้น",
  "สมาชิกใหม่วันนี้ +5 คน",
];

const STATS = [
  ["500+", "ร้านค้าใช้งาน"],
  ["2.4M+", "บิลที่ออกแล้ว"],
  ["4.8/5", "ความพึงพอใจ"],
  ["99.9%", "เวลาออนไลน์"],
];

const BENEFITS = [
  ["coins", "รู้กำไรทุกวัน", "ระบบคิดกำไรจากต้นทุนจริงให้อัตโนมัติ ไม่ต้องนั่งคิดเอง"],
  ["clock", "ปิดร้านเร็วขึ้น", "ปิดยอด นับเงินลิ้นชัก กระทบยอดจบในไม่กี่นาที"],
  ["bell", "ของไม่ขาด ไม่จม", "เตือนสินค้าใกล้หมด เห็นของขายช้า ตัดสินใจสั่งได้ทันเวลา"],
  ["heart", "ลูกค้ากลับมาซื้อ", "สะสมแต้ม โปรโมชั่น และประวัติซื้อ มัดใจลูกค้าประจำ"],
];

const FEATURES = [
  ["scan", "ขายหน้าร้าน", "สแกนบาร์โค้ด คิดเงิน ตัดสต็อกทุกบิล"],
  ["box", "คลังสินค้า", "รับเข้า โอนสาขา ตรวจนับ เตือนของใกล้หมด"],
  ["chart", "รายงาน & กำไร", "คิดจากต้นทุน ณ เวลาขายจริง ไม่เพี้ยน"],
  ["users", "ลูกค้า & สมาชิก", "ประวัติซื้อ สะสมแต้ม ขายเชื่อ ลูกหนี้"],
  ["branch", "หลายสาขา", "คุมทุกร้าน/คลังในที่เดียว แยกข้อมูลปลอดภัย"],
  ["shield", "สิทธิ์ & ความปลอดภัย", "แยกสิทธิ์เจ้าของ/พนักงาน บันทึกทุกการกระทำ"],
];

const STEPS = [
  ["1", "สมัคร + เปิดร้าน", "ตั้งชื่อร้าน เริ่มใน 1 นาที ไม่ต้องใช้บัตร"],
  ["2", "เพิ่มสินค้า", "สแกนบาร์โค้ด ตั้งราคา ใส่สต็อกตั้งต้น"],
  ["3", "เปิดขาย", "คิดเงิน รับชำระ สต็อกตัดเอง รายงานขึ้นทันที"],
];

const TESTIMONIALS = [
  ["ร้านสะดวกซื้อพี่หมี", "โชห่วย · กรุงเทพฯ", "ปิดร้านเร็วขึ้นวันละครึ่งชั่วโมง สต็อกไม่เคยขาดอีกเลย ลูกน้องคิดเงินง่ายมาก"],
  ["คาเฟ่ Bean & Co.", "คาเฟ่ · เชียงใหม่", "ดูยอดขายจากที่บ้านได้ ไม่ต้องโทรถามพนักงาน รายงานกำไรแม่นจริง"],
  ["ร้านขายส่ง ส.เจริญ", "ขายส่ง · นครปฐม", "ขายเชื่อ–ทวงหนี้เป็นระบบ ลูกหนี้ไม่ตกหล่น โอนของระหว่างคลังก็ง่าย"],
];

const FAQ = [
  ["ใช้ฟรีได้จริงไหม", "แพ็กเริ่มต้นฟรีตลอด ไม่ต้องใช้บัตรเครดิต และทุกแพ็กทดลองฟรี 14 วัน"],
  ["รองรับพร้อมเพย์ไหม", "สร้าง QR พร้อมเพย์ระบุยอดอัตโนมัติ ลูกค้าสแกนจ่ายเข้าบัญชีร้านได้ทันที"],
  ["ใช้บนมือถือได้ไหม", "ใช้ผ่านเบราว์เซอร์บนมือถือ/แท็บเล็ต/คอมได้เลย ไม่ต้องติดตั้ง"],
  ["ข้อมูลปลอดภัยแค่ไหน", "แต่ละร้านแยกข้อมูลขาดกัน รหัสผ่านเข้ารหัส มีระบบสิทธิ์และ audit log ครบ"],
];

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "ขายดี Stock",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description:
        "ระบบ POS + คลังสินค้าสำหรับร้านค้าไทย ตัดสต็อกอัตโนมัติ รับเงินสด/พร้อมเพย์ รายงานกำไร หลายสาขา",
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "THB",
        // derive จาก lib/plans.ts เพื่อไม่ให้ราคาใน schema เพี้ยนจากที่แสดงจริง
        lowPrice: String(PLANS.free.monthly),
        highPrice: String(PLANS.premium.monthly),
        offerCount: "3",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
};

/* โลโก้: โมโนแกรม "ข" บนป้ายเขียว จุดทองมุมขวา */
function LogoMark() {
  return (
    <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--green)]">
      <span className="lp-display text-lg font-bold leading-none text-white">ข</span>
      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[var(--gold)]" />
    </span>
  );
}

function WindowFrame({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--rule)] bg-white shadow-[0_28px_60px_-34px_rgba(16,35,26,0.45)]">
      <div className="flex items-center gap-2 border-b border-[var(--rule)] bg-[var(--paper-2)] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--rule)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--rule)]" />
        <span className="lp-mono ml-2 truncate text-[11px] tracking-wide text-[var(--muted2)]">
          {url}
        </span>
      </div>
      {children}
    </div>
  );
}

export default async function LandingPage() {
  const ctx = await getAppContext();
  const isAuthed = !!ctx;

  return (
    <div className="lp flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      {/* Nav — แถบเขียวเข้มต่อเนื่องกับ hero */}
      <header className="sticky top-0 z-20 bg-[var(--night)]/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="lp-display text-lg font-semibold tracking-tight">
              ขายดี <span className="text-[var(--gold)]">Stock</span>
            </span>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <a
              href="#features"
              className="hidden px-3 py-2 text-white/70 transition-colors hover:text-white sm:inline"
            >
              ฟีเจอร์
            </a>
            <a
              href="/pricing"
              className="hidden px-3 py-2 text-white/70 transition-colors hover:text-white sm:inline"
            >
              ราคา
            </a>
            {isAuthed ? (
              <Link href="/dashboard" className="lp-btn-gold !px-4 !py-2.5">
                เข้าระบบจัดการ
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3 py-2 font-medium text-white/85 transition-colors hover:text-white"
                >
                  เข้าสู่ระบบ
                </Link>
                <Link href="/signup" className="lp-btn-gold !px-4 !py-2.5">
                  เริ่มฟรี
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero — ป้ายร้านเขียวเข้ม */}
      <section className="relative overflow-hidden bg-[var(--night)] text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(52% 60% at 78% 30%, rgba(255,197,61,0.14), transparent 70%), radial-gradient(60% 70% at 12% 90%, rgba(16,163,90,0.22), transparent 70%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-14 lg:grid-cols-[1.02fr_0.98fr] lg:pb-24 lg:pt-20">
          <div>
            <span className="lp-mono inline-flex items-center gap-2 rounded-full border border-white/20 px-3.5 py-1.5 text-xs tracking-[0.14em] text-[var(--gold)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--gold)]" />
              POS + คลังสินค้า สำหรับร้านค้าไทย
            </span>
            <h1 className="lp-display mt-6 text-[2.7rem] font-bold leading-[1.12] sm:text-6xl sm:leading-[1.08]">
              ขายของ ตัดสต็อก เก็บเงิน
              <br />
              <span className="text-[var(--gold)]">จบในระบบเดียว</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-white/70">
              ตั้งแต่ร้านโชห่วยหน้าปากซอย ถึงคลังหลายสาขา —
              เห็นยอดขายและกำไรของทั้งร้านแบบสดๆ จากทุกที่
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/signup" className="lp-btn-gold text-base">
                เริ่มใช้ฟรี 14 วัน →
              </Link>
              <a href="#screens" className="lp-btn-outline-light text-base">
                ดูตัวอย่างระบบ
              </a>
            </div>
            <p className="lp-mono mt-5 text-xs tracking-wide text-white/50">
              ✓ ไม่ต้องใช้บัตรเครดิต&ensp;✓ ใช้ได้ทันทีบนมือถือ
            </p>
          </div>

          {/* Mock: หน้าจอ POS + การ์ดสถิติลอย */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="rounded-3xl bg-white p-5 text-[var(--ink)] shadow-[0_40px_90px_-40px_rgba(0,0,0,0.8)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LogoMark />
                  <div>
                    <div className="lp-display text-sm font-semibold leading-tight">
                      ขายดี Stock
                    </div>
                    <div className="text-[11px] text-[var(--muted2)]">สาขาหลัก · กะเช้า</div>
                  </div>
                </div>
                <span className="lp-mono rounded-full bg-[var(--paper-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--green)]">
                  บิล #087
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  ["น้ำเปล่า", "10"],
                  ["โค้ก", "18"],
                  ["นมจืด", "14"],
                  ["ขนมปัง", "22"],
                  ["กาแฟ", "25"],
                  ["มาม่า", "8"],
                ].map(([n, p]) => (
                  <div
                    key={n}
                    className="rounded-xl border border-[var(--rule)] bg-[var(--paper)] px-2 py-2.5 text-center"
                  >
                    <div className="text-[11px] font-medium">{n}</div>
                    <div className="lp-mono text-xs font-semibold text-[var(--green)]">
                      ฿{p}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-1.5 border-t border-dashed border-[var(--rule)] pt-3 text-xs text-[var(--muted2)]">
                <div className="flex justify-between">
                  <span>น้ำเปล่า × 2</span>
                  <span className="lp-mono">20</span>
                </div>
                <div className="flex justify-between">
                  <span>โค้ก × 1</span>
                  <span className="lp-mono">18</span>
                </div>
                <div className="flex justify-between">
                  <span>กาแฟ × 2</span>
                  <span className="lp-mono">50</span>
                </div>
              </div>

              <button
                type="button"
                tabIndex={-1}
                className="lp-mono mt-4 w-full rounded-xl bg-[var(--green)] py-3 text-sm font-bold tracking-wide text-white"
              >
                เก็บเงิน ฿88 · พร้อมเพย์
              </button>
            </div>

            {/* การ์ดลอย: ยอดขายวันนี้ */}
            <div className="absolute -right-4 -top-6 w-44 rounded-2xl bg-white p-4 text-[var(--ink)] shadow-[0_24px_50px_-24px_rgba(0,0,0,0.65)] sm:-right-10">
              <div className="text-[11px] text-[var(--muted2)]">ยอดขายวันนี้</div>
              <div className="lp-mono mt-0.5 text-xl font-bold">฿12,450</div>
              <div className="mt-1 flex items-center gap-2">
                <svg viewBox="0 0 80 26" className="h-6 w-full" aria-hidden="true">
                  <polyline
                    points="0,21 13,16 26,18 39,10 52,13 65,5 80,8"
                    fill="none"
                    stroke="var(--green)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="lp-mono text-xs font-semibold text-[var(--green)]">+18%</span>
              </div>
            </div>

            {/* การ์ดลอย: เตือนสต็อก */}
            <div className="absolute -bottom-6 -left-4 flex items-center gap-3 rounded-2xl bg-white py-3 pl-3 pr-4 text-[var(--ink)] shadow-[0_24px_50px_-24px_rgba(0,0,0,0.65)] sm:-left-10">
              <span className="lp-chip lp-chip-gold !h-10 !w-10 !rounded-xl">
                <Icon name="bell" className="h-5 w-5" />
              </span>
              <div>
                <div className="text-[11px] text-[var(--muted2)]">เตือนสต็อก</div>
                <div className="text-xs font-semibold">นมจืด เหลือ 3 ชิ้น</div>
              </div>
            </div>
          </div>
        </div>

        {/* Signature: ป้ายไฟ LED วิ่งแบบหน้าร้านไทย */}
        <div className="lp-led relative" role="presentation">
          <div className="lp-led-track">
            <div className="lp-led-group">
              {LED_ITEMS.map((t) => (
                <span key={t} className="lp-led-item">
                  {t}
                </span>
              ))}
            </div>
            <div className="lp-led-group" aria-hidden="true">
              {LED_ITEMS.map((t) => (
                <span key={t} className="lp-led-item">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats — social proof */}
      <div className="border-b border-[var(--rule)] bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-[var(--rule)] px-5 sm:grid-cols-4">
          {STATS.map(([n, l]) => (
            <div key={l} className="px-2 py-7 text-center">
              <div className="lp-mono text-3xl font-bold text-[var(--green)]">{n}</div>
              <div className="mt-1 text-xs text-[var(--muted2)]">{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Trust strip */}
      <div className="border-b border-[var(--rule)] bg-[var(--paper-2)]">
        <div className="lp-mono mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-5 py-4 text-xs tracking-wide text-[var(--muted2)]">
          <span className="font-semibold text-[var(--green)]">เหมาะกับ</span>
          <span>ร้านสะดวกซื้อ</span>
          <span>คาเฟ่</span>
          <span>ร้านขายส่ง</span>
          <span>คลังสินค้า</span>
          <span>ร้านออนไลน์</span>
        </div>
      </div>

      {/* Benefits — bento */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <span className="lp-eyebrow">ทำไมต้อง ขายดี Stock</span>
        <h2 className="lp-display mt-3 text-3xl font-bold sm:text-4xl">
          ไม่ใช่แค่คิดเงิน — แต่ทำให้ร้านโต
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map(([icon, title, desc], i) => {
            // bento: การ์ดใหญ่สลับ (ตัวที่ 1 และ 4 กว้าง 2 คอลัมน์)
            const wide = i === 0 || i === 3;
            return (
              <div key={title} className={`lp-card flex flex-col p-7 ${wide ? "lg:col-span-2" : ""}`}>
                <span className={`lp-chip ${wide ? "lp-chip-lg" : ""}`}>
                  <Icon name={icon} className={wide ? "h-7 w-7" : "h-6 w-6"} />
                </span>
                <h3 className={`lp-display mt-4 font-semibold ${wide ? "text-2xl" : "text-lg"}`}>
                  {title}
                </h3>
                <p className={`mt-2 text-[var(--muted2)] ${wide ? "max-w-md text-base" : "text-sm"}`}>
                  {desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-y border-[var(--rule)] bg-white py-20">
        <div className="mx-auto max-w-6xl px-5">
          <span className="lp-eyebrow">สิ่งที่ได้</span>
          <h2 className="lp-display mt-3 text-3xl font-bold sm:text-4xl">
            ทุกอย่างที่ร้านต้องใช้
          </h2>
          <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([icon, name, desc]) => (
              <div key={name} className="flex gap-4">
                <span className="lp-chip shrink-0">
                  <Icon name={icon} />
                </span>
                <div>
                  <h3 className="lp-display font-semibold">{name}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--muted2)]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product screens */}
      <section id="screens" className="mx-auto max-w-6xl px-5 py-20">
        <span className="lp-eyebrow">ระบบจริง</span>
        <h2 className="lp-display mt-3 text-3xl font-bold sm:text-4xl">
          เห็นของจริงก่อนสมัคร
        </h2>
        <p className="mt-3 text-[var(--muted2)]">
          หน้าตาใช้งานง่าย ออกแบบมาเพื่อความเร็วหน้าร้าน
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* Dashboard mock */}
          <WindowFrame url="khaideestock.com/dashboard">
            <div className="bg-[var(--paper)] p-4">
              <div className="lp-display text-sm font-semibold">ภาพรวมร้าน</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  ["ยอดขายวันนี้", "฿12,450"],
                  ["กำไรวันนี้", "฿3,980"],
                  ["บิลวันนี้", "86"],
                  ["ของใกล้หมด", "4"],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-xl border border-[var(--rule)] bg-white p-3">
                    <div className="text-[10px] text-[var(--muted2)]">{l}</div>
                    <div className="lp-mono text-base font-bold">{v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-end gap-1.5 rounded-xl border border-[var(--rule)] bg-white p-3">
                {[40, 65, 50, 80, 60, 95, 72].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t"
                    style={{ height: h, background: i === 5 ? "var(--gold)" : "var(--green)" }}
                  />
                ))}
              </div>
            </div>
          </WindowFrame>

          {/* POS mock */}
          <WindowFrame url="khaideestock.com/pos">
            <div className="grid grid-cols-[1fr_130px] gap-3 bg-[var(--paper)] p-4">
              <div className="grid grid-cols-3 gap-2">
                {["น้ำเปล่า", "โค้ก", "ขนมปัง", "นม", "กาแฟ", "ขนม"].map((n) => (
                  <div
                    key={n}
                    className="rounded-xl border border-[var(--rule)] bg-white p-2 text-center"
                  >
                    <div className="text-[10px]">{n}</div>
                    <div className="lp-mono text-[11px] font-bold text-[var(--green)]">฿10</div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-[var(--rule)] bg-white p-2.5">
                <div className="text-[10px] font-semibold">ตะกร้า</div>
                <div className="mt-2 space-y-1 text-[9px] text-[var(--muted2)]">
                  <div className="flex justify-between">
                    <span>น้ำเปล่า×2</span>
                    <span>20</span>
                  </div>
                  <div className="flex justify-between">
                    <span>โค้ก×1</span>
                    <span>15</span>
                  </div>
                </div>
                <div className="lp-mono mt-2 rounded-lg bg-[var(--green)] py-1.5 text-center text-[9px] font-bold text-white">
                  เก็บเงิน ฿35
                </div>
              </div>
            </div>
          </WindowFrame>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-[var(--rule)] bg-[var(--paper-2)] py-20">
        <div className="mx-auto max-w-5xl px-5">
          <span className="lp-eyebrow">ขั้นตอน</span>
          <h2 className="lp-display mt-3 text-3xl font-bold sm:text-4xl">
            เปิดร้านขายได้ใน 3 ขั้น
          </h2>
          <div className="relative mt-12 grid gap-8 sm:grid-cols-3">
            {/* เส้นประเชื่อมขั้นตอน */}
            <div
              aria-hidden="true"
              className="absolute inset-x-[16%] top-6 hidden border-t-2 border-dashed border-[var(--rule)] sm:block"
            />
            {STEPS.map(([n, title, desc]) => (
              <div key={n} className="relative flex flex-col items-start">
                <div className="lp-mono relative flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--night)] text-lg font-bold text-[var(--gold)]">
                  {n}
                </div>
                <div className="lp-card mt-5 w-full p-6">
                  <h3 className="lp-display text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-[var(--muted2)]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <span className="lp-eyebrow">เสียงจากร้านค้า</span>
        <h2 className="lp-display mt-3 text-3xl font-bold sm:text-4xl">ร้านจริงใช้จริง</h2>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map(([shop, type, quote]) => (
            <figure key={shop} className="lp-card flex flex-col p-7">
              <div className="tracking-[0.2em] text-[var(--gold)]" aria-label="5 ดาว">
                ★★★★★
              </div>
              <blockquote className="mt-3 flex-1 text-[15px] leading-relaxed">
                “{quote}”
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-[var(--rule)] pt-4">
                <span className="lp-display flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--night)] text-lg font-semibold text-[var(--gold)]">
                  {shop.charAt(0)}
                </span>
                <span>
                  <span className="block font-semibold">{shop}</span>
                  <span className="block text-xs text-[var(--muted2)]">{type}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <Pricing tiers={PUBLIC_PLANS} />

      {/* FAQ */}
      <section className="mx-auto w-full max-w-3xl px-5 pb-20">
        <span className="lp-eyebrow">คำถามที่พบบ่อย</span>
        <h2 className="lp-display mt-3 text-3xl font-bold sm:text-4xl">เคลียร์ก่อนเริ่ม</h2>
        <div className="lp-card mt-8 divide-y divide-[var(--rule)] overflow-hidden">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group px-6 py-4">
              <summary className="lp-display flex cursor-pointer list-none items-center justify-between font-semibold">
                {q}
                <span className="lp-mono text-[var(--muted2)] transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-[var(--muted2)]">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-[var(--night)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(50% 80% at 50% 100%, rgba(255,197,61,0.12), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-5 py-20 text-center text-white">
          <h2 className="lp-display text-3xl font-bold sm:text-4xl">
            พร้อมเปลี่ยนร้านให้<span className="text-[var(--gold)]">ขายดี</span>?
          </h2>
          <p className="mt-3 text-white/70">
            เริ่มฟรีวันนี้ ตั้งค่าเสร็จใน 5 นาที ไม่ต้องใช้บัตรเครดิต
          </p>
          <Link href="/signup" className="lp-btn-gold mt-8 text-base">
            เริ่มใช้ฟรี →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[var(--night)] text-white">
        <div className="mx-auto grid max-w-6xl gap-8 border-t border-white/10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <LogoMark />
              <span className="lp-display text-lg font-semibold">
                ขายดี <span className="text-[var(--gold)]">Stock</span>
              </span>
            </div>
            <p className="mt-3 text-sm text-white/60">
              ระบบ POS + คลังสินค้าสำหรับร้านค้าไทย ครบ จบ ในระบบเดียว
            </p>
          </div>
          <div>
            <div className="lp-mono text-xs font-semibold tracking-[0.14em] text-[var(--gold)]">
              ผลิตภัณฑ์
            </div>
            <ul className="mt-3 space-y-2 text-sm text-white/60">
              <li>
                <a href="#features" className="hover:text-white">ฟีเจอร์</a>
              </li>
              <li>
                <a href="/pricing" className="hover:text-white">ราคา</a>
              </li>
              <li>
                <a href="#screens" className="hover:text-white">ตัวอย่างระบบ</a>
              </li>
              <li>
                <Link href="/signup" className="hover:text-white">เริ่มใช้ฟรี</Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="lp-mono text-xs font-semibold tracking-[0.14em] text-[var(--gold)]">
              บริษัท
            </div>
            <ul className="mt-3 space-y-2 text-sm text-white/60">
              <li>
                <span className="cursor-default">เกี่ยวกับเรา</span>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white">
                  นโยบายความเป็นส่วนตัว (PDPA)
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white">ข้อตกลงการใช้งาน</Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="lp-mono text-xs font-semibold tracking-[0.14em] text-[var(--gold)]">
              ติดต่อ
            </div>
            <ul className="mt-3 space-y-2 text-sm text-white/60">
              <li>LINE: @khaideestock</li>
              <li>hello@khaideestock.com</li>
              <li>02-000-0000</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-5">
          <p className="lp-mono text-center text-xs tracking-wide text-white/40">
            © {new Date().getFullYear()} ขายดี Stock · ระบบร้านค้าไทย
          </p>
        </div>
      </footer>
    </div>
  );
}
