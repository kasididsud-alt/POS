import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext } from "@/lib/auth";
import { PLANS, PUBLIC_PLANS, type PlanId } from "@/lib/plans";
import Pricing from "@/components/landing/Pricing";
import PricingComparison from "./PricingComparison";
import PricingFaq from "./PricingFaq";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  // title.template ใน layout จะเติม "· ขายดี Stock" ให้เอง — ห้ามใส่แบรนด์ซ้ำในนี้
  title: "ราคาแพ็กเกจ โปรแกรม POS + ระบบจัดการสต็อก เริ่มฟรี",
  description:
    "เทียบแพ็กเกจ ขายดี Stock แบบละเอียด — เริ่มต้น (ฟรี) / ร้านค้า ฿399 / มืออาชีพ ฿990 / องค์กร ติดต่อ ไม่ต้องใช้บัตรเครดิต",
  alternates: { canonical: "/pricing" },
};

// FAQ สำหรับ structured data — ต้องตรงกับ PricingFaq.tsx (ยังแยก component ไม่ได้ในสโคปนี้)
const PRICING_FAQ: { q: string; a: string }[] = [
  {
    q: "ทดลองใช้ฟรีได้ไหม ต้องใส่บัตรเครดิตก่อนไหม?",
    a: "แพ็กเริ่มต้นใช้ฟรีถาวร ไม่มีค่าใช้จ่าย · ส่วนแพ็กร้านค้าและมืออาชีพ ทดลองฟรี 14 วัน โดยไม่ต้องผูกบัตรก่อน จะเริ่มเก็บเงินก็ต่อเมื่อคุณเลือกสมัครต่อเท่านั้น",
  },
  {
    q: "เปลี่ยนแพ็ก หรือยกเลิกได้ไหม?",
    a: "ได้ทุกเมื่อ ไม่มีสัญญาผูกมัด — อัปเกรด ดาวน์เกรด หรือยกเลิกเองได้ในหน้า “แพ็กเกจ” ถ้ายกเลิกจะใช้งานได้จนจบรอบที่จ่ายไปแล้ว",
  },
  {
    q: "จ่ายเงินอย่างไร? มีส่วนลดรายปีไหม?",
    a: "ชำระผ่านบัตรเครดิต/เดบิตด้วยระบบ Stripe ที่ปลอดภัยตามมาตรฐานสากล · เลือกจ่ายรายปีจะประหยัดประมาณ 2 เดือนเมื่อเทียบกับรายเดือน",
  },
  {
    q: "ถ้าจำนวนสินค้าเกินลิมิตของแพ็กจะเป็นอย่างไร?",
    a: "ข้อมูลเดิมทั้งหมดยังอยู่ครบ ไม่หายไปไหน · ระบบจะแจ้งให้อัปเกรดเมื่อคุณจะเพิ่มสินค้าเกินโควตา พออัปเกรดแล้วเพิ่มต่อได้ทันที",
  },
  {
    q: "ข้อมูลของร้านปลอดภัยไหม เอาข้อมูลออกได้ไหม?",
    a: "ข้อมูลเป็นของร้านคุณ 100% · สำรองข้อมูลอัตโนมัติ และส่งออกเป็นไฟล์ Excel/CSV ได้ (แพ็กมืออาชีพขึ้นไป) ไม่ล็อกข้อมูลคุณไว้กับเรา",
  },
  {
    q: "มีค่าติดตั้ง หรือต้องซื้อเครื่องเฉพาะไหม?",
    a: "ไม่มีค่าติดตั้ง และไม่ต้องซื้อเครื่องเฉพาะ · ใช้งานผ่านมือถือ แท็บเล็ต หรือคอมพิวเตอร์ที่มีอยู่แล้วได้เลย รองรับเครื่องพิมพ์ใบเสร็จ/เครื่องสแกนบาร์โค้ดทั่วไป",
  },
  {
    q: "แพ็กองค์กร (เชน/บริษัท) ราคาเท่าไร?",
    a: "คิดราคาตามขนาดการใช้งาน (จำนวนสาขา/ผู้ใช้) รวมฟีเจอร์พิเศษ เช่น API เชื่อมระบบ สร้าง Role เอง ผู้ดูแลเฉพาะ และ SLA · ติดต่อทีมงานเพื่อรับใบเสนอราคาที่พอดีกับองค์กรคุณ",
  },
  {
    q: "รองรับหลายสาขาไหม?",
    a: "รองรับ — ตั้งแต่แพ็กมืออาชีพขึ้นไป จัดการหลายสาขาในบัญชีเดียว โอนย้ายสต็อกระหว่างสาขา และดูรายงานรวมทุกสาขาได้",
  },
];

// derive ราคา Offer จาก lib/plans.ts เพื่อไม่ให้ schema เพี้ยนจากราคาจริง
const OFFER_TIERS: PlanId[] = ["free", "pro", "premium"];

const PRICING_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "ขายดี Stock",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: `${SITE_URL}/pricing`,
      description:
        "โปรแกรมขายหน้าร้าน (POS) + ระบบจัดการสต็อกสำหรับร้านค้าไทย ตัดสต็อกอัตโนมัติ รับเงินสด/พร้อมเพย์ รายงานกำไร หลายสาขา",
      offers: OFFER_TIERS.map((id) => ({
        "@type": "Offer",
        name: PLANS[id].name,
        price: String(PLANS[id].monthly),
        priceCurrency: "THB",
        url: `${SITE_URL}/pricing`,
      })),
    },
    {
      "@type": "FAQPage",
      mainEntity: PRICING_FAQ.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
};

export default async function PublicPricingPage() {
  const ctx = await getAppContext();
  const isAuthed = !!ctx?.org;

  return (
    <div className="lp flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(PRICING_JSON_LD) }}
      />
      <div className="lp-bg" aria-hidden="true" />

      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-[var(--rule)] bg-[var(--paper)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link
            href="/"
            className="lp-mono flex items-center gap-2 text-lg font-bold tracking-tight"
          >
            <span>🧾</span> ขายดี Stock
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/#features"
              className="lp-mono hidden px-3 py-2 text-[var(--muted2)] hover:text-[var(--ink)] sm:inline"
            >
              ฟีเจอร์
            </Link>
            <span className="lp-mono hidden px-3 py-2 font-bold text-[var(--ink)] sm:inline">
              ราคา
            </span>
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
      <section className="mx-auto w-full max-w-6xl px-5 pb-2 pt-16 text-center sm:pt-24">
        <div className="lp-mono text-xs text-[var(--green-d)]">{"// ราคา"}</div>
        <h1 className="lp-display mx-auto mt-3 max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
          ราคาตรงไปตรงมา จ่ายเท่าที่ใช้
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[var(--muted2)]">
          เริ่มฟรีทันที ไม่ต้องใช้บัตรเครดิต · อัปเกรดเมื่อร้านโต · ยกเลิกเมื่อไหร่ก็ได้
        </p>
        <div className="lp-mono mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-[var(--muted2)]">
          <span className="text-[var(--green-d)]">✓ ทดลอง Pro/Premium ฟรี 14 วัน</span>
          <span className="text-[var(--green-d)]">✓ ข้อมูลของคุณ Export ได้</span>
          <span className="text-[var(--green-d)]">✓ รองรับพร้อมเพย์</span>
        </div>
      </section>

      {/* การ์ดราคา (ใช้ component เดียวกับหน้าแรก) */}
      <Pricing tiers={PUBLIC_PLANS} />

      {/* ตารางเทียบทุกฟีเจอร์ */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-20">
        <div className="lp-mono text-xs text-[var(--green-d)]">{"// เทียบละเอียด"}</div>
        <h2 className="lp-display mt-2 text-2xl font-bold sm:text-3xl">
          เทียบทุกฟีเจอร์แบบละเอียด
        </h2>
        <p className="mt-2 text-[var(--muted2)]">
          ทุกฟีเจอร์ ทุกแพ็ก เทียบชัด ๆ ในที่เดียว
        </p>
        <div className="lp-card mt-8 p-3 sm:p-6">
          <PricingComparison />
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full max-w-3xl px-5 pb-20">
        <div className="lp-mono text-xs text-[var(--green-d)]">{"// คำถามที่พบบ่อย"}</div>
        <h2 className="lp-display mt-2 text-2xl font-bold sm:text-3xl">สงสัยตรงไหน?</h2>
        <PricingFaq />
      </section>

      {/* CTA ปิดท้าย */}
      <section className="mx-auto mb-24 w-full max-w-6xl px-5">
        <div className="lp-card flex flex-col items-center gap-4 p-10 text-center sm:p-14">
          <div className="lp-stamp inline-block text-[11px]">เริ่มฟรี</div>
          <h2 className="lp-display max-w-lg text-2xl font-bold sm:text-3xl">
            พร้อมเปิดร้านให้ขายดีกว่าเดิม?
          </h2>
          <p className="max-w-md text-[var(--muted2)]">
            ตั้งร้านเสร็จใน 1 นาที ไม่ต้องใช้บัตรเครดิต ทดลองฟีเจอร์เต็มได้ 14 วัน
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link
              href={isAuthed ? "/dashboard" : "/signup"}
              className="lp-btn-solid"
            >
              {isAuthed ? "เข้าระบบจัดการ" : "เริ่มใช้ฟรี"}
            </Link>
            {!isAuthed && (
              <Link href="/login" className="lp-btn-ghost">
                เข้าสู่ระบบ
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
