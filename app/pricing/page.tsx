import Link from "next/link";
import { getAppContext } from "@/lib/auth";
import Pricing from "@/components/landing/Pricing";
import PricingComparison from "./PricingComparison";
import PricingFaq from "./PricingFaq";

export const metadata = {
  title: "ราคา · ขายดี Stock",
  description:
    "เทียบแพ็กเกจ ขายดี Stock แบบละเอียด — เริ่มต้น (ฟรี) / ร้านค้า ฿399 / มืออาชีพ ฿990 / องค์กร เริ่มฟรี ไม่ต้องใช้บัตรเครดิต",
};

export default async function PublicPricingPage() {
  const ctx = await getAppContext();
  const isAuthed = !!ctx?.org;

  return (
    <div className="lp flex min-h-screen flex-col">
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
      <Pricing />

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
