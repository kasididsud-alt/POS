import Link from "next/link";
import { getAppContext } from "@/lib/auth";
import Pricing from "@/components/landing/Pricing";

const RECEIPT_LINES = [
  "ขายหน้าร้าน (POS)",
  "ตัดสต็อกอัตโนมัติ",
  "รับเงินสด / พร้อมเพย์",
  "ลูกค้า · แต้ม · โปรโมชั่น",
  "รายงานกำไรแม่นยำ",
  "หลายสาขา · คลังสินค้า",
];

const STATS = [
  ["500+", "ร้านค้าใช้งาน"],
  ["2.4M+", "บิลที่ออกแล้ว"],
  ["4.8/5", "ความพึงพอใจ"],
  ["99.9%", "เวลาออนไลน์"],
];

const BENEFITS = [
  ["💰", "รู้กำไรทุกวัน", "ระบบคิดกำไรจากต้นทุนจริงให้อัตโนมัติ ไม่ต้องนั่งคิดเอง"],
  ["⏱️", "ปิดร้านเร็วขึ้น", "ปิดยอด นับเงินลิ้นชัก กระทบยอดจบในไม่กี่นาที"],
  ["📉", "ของไม่ขาด ไม่จม", "เตือนสินค้าใกล้หมด เห็นของขายช้า ตัดสินใจสั่งได้ทันเวลา"],
  ["🔁", "ลูกค้ากลับมาซื้อ", "สะสมแต้ม โปรโมชั่น และประวัติซื้อ มัดใจลูกค้าประจำ"],
];

const FEATURES = [
  ["🧾", "ขายหน้าร้าน", "สแกนบาร์โค้ด คิดเงิน ตัดสต็อกทุกบิล"],
  ["📦", "คลังสินค้า", "รับเข้า โอนสาขา ตรวจนับ เตือนของใกล้หมด"],
  ["📊", "รายงาน & กำไร", "คิดจากต้นทุน ณ เวลาขายจริง ไม่เพี้ยน"],
  ["👥", "ลูกค้า & สมาชิก", "ประวัติซื้อ สะสมแต้ม ขายเชื่อ ลูกหนี้"],
  ["🏢", "หลายสาขา", "คุมทุกร้าน/คลังในที่เดียว แยกข้อมูลปลอดภัย"],
  ["🔒", "สิทธิ์ & ความปลอดภัย", "แยกสิทธิ์เจ้าของ/พนักงาน บันทึกทุกการกระทำ"],
];

const STEPS = [
  ["01", "สมัคร + เปิดร้าน", "ตั้งชื่อร้าน เริ่มใน 1 นาที ไม่ต้องใช้บัตร"],
  ["02", "เพิ่มสินค้า", "สแกนบาร์โค้ด ตั้งราคา ใส่สต็อกตั้งต้น"],
  ["03", "เปิดขาย", "คิดเงิน รับชำระ สต็อกตัดเอง รายงานขึ้นทันที"],
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
        lowPrice: "0",
        highPrice: "790",
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

function BrowserFrame({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--rule)] bg-white shadow-[0_24px_60px_-30px_rgba(24,34,28,0.4)]">
      <div className="flex items-center gap-2 border-b border-[var(--rule)] bg-[var(--paper-2)] px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#E0492B]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#E3B341]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#0E7A43]" />
        <span className="lp-mono ml-3 truncate text-[11px] text-[var(--muted2)]">
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

      {/* พื้นหลัง: กริดจุด + แสงเขียวนวล */}
      <div className="lp-bg" aria-hidden="true" />

      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-[var(--rule)] bg-[var(--paper)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="lp-mono flex items-center gap-2 text-lg font-bold tracking-tight">
            <span>🧾</span> ขายดี Stock
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <a href="#features" className="lp-mono hidden px-3 py-2 text-[var(--muted2)] hover:text-[var(--ink)] sm:inline">
              ฟีเจอร์
            </a>
            <a href="/pricing" className="lp-mono hidden px-3 py-2 text-[var(--muted2)] hover:text-[var(--ink)] sm:inline">
              ราคา
            </a>
            {isAuthed ? (
              <Link href="/dashboard" className="lp-btn-solid">
                เข้าระบบจัดการ
              </Link>
            ) : (
              <>
                <Link href="/login" className="lp-btn-ghost">
                  เข้าสู่ระบบ
                </Link>
                <Link href="/signup" className="lp-btn-solid">
                  เริ่มฟรี
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div>
            <span className="lp-mono inline-flex items-center gap-2 rounded-full border border-[var(--rule)] bg-white px-3 py-1 text-xs text-[var(--green-d)]">
              <span className="h-2 w-2 rounded-full bg-[var(--green)]" />
              ระบบขายหน้าร้าน + คลังสินค้า
            </span>
            <h1 className="lp-display mt-6 text-[2.6rem] font-bold leading-[1.05] sm:text-6xl">
              ขายของ ตัดสต็อก
              <br />
              เก็บเงิน <span className="text-[var(--green)]">จบในใบเดียว</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-[var(--muted2)]">
              ระบบ POS + คลังสินค้าสำหรับร้านไทย ตั้งแต่ร้านโชห่วยหน้าปากซอย
              ถึงคลังหลายสาขา — เริ่มฟรีวันนี้
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="lp-btn-solid text-base">
                เริ่มใช้ฟรี 14 วัน →
              </Link>
              <a href="#screens" className="lp-btn-ghost text-base">
                ดูตัวอย่างระบบ
              </a>
            </div>
            <p className="lp-mono mt-4 text-xs text-[var(--muted2)]">
              ✓ ไม่ต้องใช้บัตรเครดิต ✓ ใช้ได้ทันทีบนมือถือ
            </p>
          </div>

          {/* Signature: สลิปใบเสร็จ */}
          <div className="relative mx-auto w-full max-w-xs">
            <div className="lp-receipt lp-mono px-6 pb-8 pt-6 text-sm text-[var(--ink)]">
              <div className="text-center">
                <div className="text-base font-bold tracking-[0.2em]">ขายดี Stock</div>
                <div className="mt-1 text-[11px] text-[var(--muted2)]">
                  ใบเสร็จ #0001 · ครบทุกอย่าง
                </div>
              </div>
              <div className="lp-perf my-4" />
              <div className="space-y-2.5">
                {RECEIPT_LINES.map((l) => (
                  <div key={l} className="lp-leader">
                    <span>{l}</span>
                    <span className="fill" />
                    <span className="font-bold text-[var(--green)]">✓</span>
                  </div>
                ))}
              </div>
              <div className="lp-perf my-4" />
              <div className="flex items-baseline justify-between font-bold">
                <span>รวม</span>
                <span>ครบในระบบเดียว</span>
              </div>
              <div className="lp-barcode mt-5" />
              <div className="mt-2 text-center text-[10px] tracking-[0.3em] text-[var(--muted2)]">
                8 850 KHAIDEE 001
              </div>
            </div>
            <div className="lp-stamp absolute -right-3 top-6 text-xs font-bold">
              เริ่มฟรี 14 วัน
            </div>
          </div>
        </div>
      </section>

      {/* Stats — social proof */}
      <div className="border-y border-[var(--rule)] bg-white">
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
        <div className="lp-mono mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-7 gap-y-2 px-5 py-4 text-xs text-[var(--muted2)]">
          <span>เหมาะกับ</span>
          <span>▸ ร้านสะดวกซื้อ</span>
          <span>▸ คาเฟ่</span>
          <span>▸ ร้านขายส่ง</span>
          <span>▸ คลังสินค้า</span>
          <span>▸ ร้านออนไลน์</span>
        </div>
      </div>

      {/* Product screens */}
      <section id="screens" className="mx-auto max-w-6xl px-5 py-20">
        <div className="lp-mono text-xs text-[var(--green-d)]">{"// ระบบจริง"}</div>
        <h2 className="lp-display mt-2 text-3xl font-bold sm:text-4xl">
          เห็นของจริงก่อนสมัคร
        </h2>
        <p className="mt-3 text-[var(--muted2)]">
          หน้าตาใช้งานง่าย ออกแบบมาเพื่อความเร็วหน้าร้าน
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* Dashboard mock */}
          <BrowserFrame url="khaideestock.com/dashboard">
            <div className="bg-[#f8fafc] p-4">
              <div className="text-sm font-semibold text-[#0f172a]">ภาพรวมร้าน</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  ["ยอดขายวันนี้", "฿12,450"],
                  ["กำไรวันนี้", "฿3,980"],
                  ["บิลวันนี้", "86"],
                  ["ของใกล้หมด", "4"],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-lg border border-[#e2e8f0] bg-white p-3">
                    <div className="text-[10px] text-[#64748b]">{l}</div>
                    <div className="text-base font-bold text-[#0f172a]">{v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-end gap-1.5 rounded-lg border border-[#e2e8f0] bg-white p-3">
                {[40, 65, 50, 80, 60, 95, 72].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t bg-[#4f46e5]" style={{ height: h }} />
                ))}
              </div>
            </div>
          </BrowserFrame>

          {/* POS mock */}
          <BrowserFrame url="khaideestock.com/pos">
            <div className="grid grid-cols-[1fr_120px] gap-3 bg-[#f8fafc] p-4">
              <div className="grid grid-cols-3 gap-2">
                {["น้ำเปล่า", "โค้ก", "ขนมปัง", "นม", "กาแฟ", "ขนม"].map((n) => (
                  <div key={n} className="rounded-lg border border-[#e2e8f0] bg-white p-2 text-center">
                    <div className="text-[10px] text-[#0f172a]">{n}</div>
                    <div className="text-[11px] font-bold text-[#4f46e5]">฿10</div>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-[#e2e8f0] bg-white p-2">
                <div className="text-[10px] font-semibold text-[#0f172a]">🧾 ตะกร้า</div>
                <div className="mt-2 space-y-1 text-[9px] text-[#64748b]">
                  <div className="flex justify-between"><span>น้ำเปล่า×2</span><span>20</span></div>
                  <div className="flex justify-between"><span>โค้ก×1</span><span>15</span></div>
                </div>
                <div className="mt-2 rounded bg-[#4f46e5] py-1 text-center text-[9px] font-bold text-white">
                  เก็บเงิน ฿35
                </div>
              </div>
            </div>
          </BrowserFrame>
        </div>
      </section>

      {/* Benefits — outcomes */}
      <section className="border-y border-[var(--rule)] bg-[var(--paper-2)] py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="lp-mono text-xs text-[var(--green-d)]">{"// ทำไมต้อง ขายดี Stock"}</div>
          <h2 className="lp-display mt-2 text-3xl font-bold sm:text-4xl">
            ไม่ใช่แค่คิดเงิน — แต่ทำให้ร้านโต
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map(([icon, title, desc], i) => {
              // bento: การ์ดใหญ่สลับ (ตัวที่ 1 และ 4 กว้าง 2 คอลัมน์)
              const wide = i === 0 || i === 3;
              return (
                <div
                  key={title}
                  className={`lp-card flex flex-col p-7 ${
                    wide ? "lg:col-span-2" : ""
                  }`}
                >
                  <div className={`lp-chip ${wide ? "lp-chip-lg" : ""}`}>{icon}</div>
                  <h3
                    className={`lp-display mt-4 font-bold ${
                      wide ? "text-2xl" : "text-lg"
                    }`}
                  >
                    {title}
                  </h3>
                  <p
                    className={`mt-2 text-[var(--muted2)] ${
                      wide ? "max-w-md text-base" : "text-sm"
                    }`}
                  >
                    {desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features — itemized list */}
      <section id="features" className="mx-auto max-w-5xl px-5 py-20">
        <div className="lp-mono text-xs text-[var(--green-d)]">{"// สิ่งที่ได้"}</div>
        <h2 className="lp-display mt-2 text-3xl font-bold sm:text-4xl">
          ทุกอย่างที่ร้านต้องใช้ ในรายการเดียว
        </h2>
        <div className="lp-card mt-10 overflow-hidden">
          {FEATURES.map(([icon, name, desc], i) => (
            <div
              key={name}
              className={`flex items-center gap-4 px-6 py-5 transition-colors hover:bg-[var(--paper-2)] ${
                i !== FEATURES.length - 1 ? "border-b border-[var(--rule)]" : ""
              }`}
            >
              <span
                className="lp-chip shrink-0"
                style={{ width: 42, height: 42, fontSize: 21 }}
              >
                {icon}
              </span>
              <span className="lp-display w-40 shrink-0 font-semibold">{name}</span>
              <span className="hidden flex-1 border-b-2 border-dotted border-[var(--rule)] sm:block" />
              <span className="flex-1 text-sm text-[var(--muted2)] sm:flex-none sm:text-right">
                {desc}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-[var(--rule)] bg-[var(--paper-2)] py-20">
        <div className="mx-auto max-w-5xl px-5">
          <div className="lp-mono text-xs text-[var(--green-d)]">{"// ขั้นตอน"}</div>
          <h2 className="lp-display mt-2 text-3xl font-bold sm:text-4xl">
            เปิดร้านขายได้ใน 3 ขั้น
          </h2>
          <div className="relative mt-12 grid gap-8 sm:grid-cols-3">
            {/* เส้นปรุเชื่อมขั้นตอน */}
            <div
              aria-hidden="true"
              className="absolute inset-x-[16%] top-7 hidden border-t-2 border-dashed border-[var(--rule)] sm:block"
            />
            {STEPS.map(([n, title, desc]) => (
              <div key={n} className="relative flex flex-col items-start">
                <div className="lp-mono flex h-14 w-14 items-center justify-center rounded-full border-2 border-[var(--green)] bg-[var(--paper-2)] text-xl font-bold text-[var(--green)]">
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
        <div className="lp-mono text-xs text-[var(--green-d)]">{"// เสียงจากร้านค้า"}</div>
        <h2 className="lp-display mt-2 text-3xl font-bold sm:text-4xl">
          ร้านจริงใช้จริง
        </h2>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map(([shop, type, quote]) => (
            <figure key={shop} className="lp-card flex flex-col p-7">
              <div className="text-lg tracking-wide text-[var(--green)]">★★★★★</div>
              <blockquote className="mt-3 flex-1 text-[15px] leading-relaxed">
                “{quote}”
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-[var(--rule)] pt-4">
                <span className="lp-display flex h-11 w-11 items-center justify-center rounded-full bg-[var(--green)] text-lg font-bold text-white">
                  {shop.charAt(0)}
                </span>
                <span>
                  <span className="block font-semibold">{shop}</span>
                  <span className="lp-mono block text-xs text-[var(--muted2)]">
                    {type}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <Pricing />

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-5 pb-20">
        <div className="lp-mono text-xs text-[var(--green-d)]">{"// คำถามที่พบบ่อย"}</div>
        <h2 className="lp-display mt-2 text-3xl font-bold sm:text-4xl">เคลียร์ก่อนเริ่ม</h2>
        <div className="lp-card mt-8 divide-y divide-[var(--rule)] overflow-hidden">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group px-5 py-4">
              <summary className="lp-display flex cursor-pointer list-none items-center justify-between font-semibold">
                {q}
                <span className="lp-mono text-[var(--muted2)] transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-[var(--muted2)]">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-[var(--green-d)]">
        <div className="mx-auto max-w-4xl px-5 py-20 text-center text-white">
          <h2 className="lp-display text-3xl font-bold sm:text-4xl">
            พร้อมเปลี่ยนร้านให้เป็นระบบ?
          </h2>
          <p className="mt-3 text-green-100">
            เริ่มฟรีวันนี้ ตั้งค่าเสร็จใน 5 นาที ไม่ต้องใช้บัตรเครดิต
          </p>
          <Link
            href="/signup"
            className="lp-mono mt-8 inline-flex rounded-md bg-white px-8 py-3 text-sm font-bold text-[var(--green-d)] hover:bg-green-50"
          >
            เริ่มใช้ฟรี →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--rule)] bg-[var(--paper)]">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="lp-mono flex items-center gap-2 text-lg font-bold">
              <span>🧾</span> ขายดี Stock
            </div>
            <p className="mt-3 text-sm text-[var(--muted2)]">
              ระบบ POS + คลังสินค้าสำหรับร้านค้าไทย ครบ จบ ในระบบเดียว
            </p>
          </div>
          <div>
            <div className="lp-mono text-xs font-bold text-[var(--ink)]">ผลิตภัณฑ์</div>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted2)]">
              <li><a href="#features" className="hover:text-[var(--ink)]">ฟีเจอร์</a></li>
              <li><a href="/pricing" className="hover:text-[var(--ink)]">ราคา</a></li>
              <li><a href="#screens" className="hover:text-[var(--ink)]">ตัวอย่างระบบ</a></li>
              <li><Link href="/signup" className="hover:text-[var(--ink)]">เริ่มใช้ฟรี</Link></li>
            </ul>
          </div>
          <div>
            <div className="lp-mono text-xs font-bold text-[var(--ink)]">บริษัท</div>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted2)]">
              <li><span className="cursor-default">เกี่ยวกับเรา</span></li>
              <li><Link href="/privacy" className="hover:text-[var(--ink)]">นโยบายความเป็นส่วนตัว (PDPA)</Link></li>
              <li><Link href="/terms" className="hover:text-[var(--ink)]">ข้อตกลงการใช้งาน</Link></li>
            </ul>
          </div>
          <div>
            <div className="lp-mono text-xs font-bold text-[var(--ink)]">ติดต่อ</div>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted2)]">
              <li>💬 LINE: @khaideestock</li>
              <li>✉️ hello@khaideestock.com</li>
              <li>📞 02-000-0000</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[var(--rule)] py-5">
          <p className="lp-mono text-center text-xs text-[var(--muted2)]">
            © {new Date().getFullYear()} ขายดี Stock · ระบบร้านค้าไทย
          </p>
        </div>
      </footer>
    </div>
  );
}
