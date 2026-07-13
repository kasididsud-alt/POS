"use client";

import Link from "next/link";
import { useState } from "react";

type Tier = {
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  features: string[];
  cta: string;
  highlight?: boolean;
};

const TIERS: Tier[] = [
  {
    name: "เริ่มต้น",
    tagline: "ร้านเล็ก เพิ่งเริ่ม",
    monthly: 0,
    yearly: 0,
    cta: "เริ่มใช้ฟรี",
    features: [
      "1 สาขา · 1 ผู้ใช้",
      "สินค้าไม่เกิน 80 รายการ",
      "POS + ตัดสต็อกอัตโนมัติ",
      "รับเงินสด / พร้อมเพย์",
      "สแกนบาร์โค้ด + ใบเสร็จ",
      "รายงานยอดขายพื้นฐาน",
    ],
  },
  {
    name: "ร้านค้า",
    tagline: "ร้านทั่วไป — ยอดนิยม",
    monthly: 399,
    yearly: 3990,
    highlight: true,
    cta: "ทดลองฟรี 14 วัน",
    features: [
      "ทุกอย่างในแพ็กเริ่มต้น",
      "สินค้าไม่เกิน 500 · บิลไม่จำกัด",
      "พนักงานถึง 5 คน + แยกสิทธิ์",
      "ลูกค้า / แต้ม / โปรโมชั่น",
      "รายงานเต็ม + กำไรแม่นยำ",
      "พิมพ์ฉลาก/บาร์โค้ด + แจ้งเตือนสต็อก",
    ],
  },
  {
    name: "มืออาชีพ",
    tagline: "หลายสาขา / คลังใหญ่",
    monthly: 990,
    yearly: 9900,
    cta: "ทดลองฟรี 14 วัน",
    features: [
      "ทุกอย่างในแพ็กร้านค้า",
      "สินค้าไม่เกิน 5,000 · ผู้ใช้ไม่จำกัด",
      "หลายสาขา + โอนย้ายสต็อก",
      "ตรวจนับ + ตำแหน่งจัดเก็บ + ล็อตสินค้า",
      "ใบสั่งซื้อ (PO) + ซัพพลายเออร์",
      "ลูกหนี้/ขายเชื่อ + VAT + Export",
      "สิทธิ์ละเอียด + audit log",
    ],
  },
];

export default function Pricing() {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="border-y border-[var(--rule)] bg-white">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <span className="lp-eyebrow">ราคา</span>
        <h2 className="lp-display mt-3 text-3xl font-bold sm:text-4xl">
          เลือกแพ็กที่พอดีกับร้าน
        </h2>
        <p className="mt-3 text-[var(--muted2)]">
          เริ่มฟรี ไม่ต้องใช้บัตรเครดิต · ยกเลิกเมื่อไหร่ก็ได้
        </p>

        {/* toggle รายเดือน/รายปี */}
        <div className="mt-7 flex items-center gap-3 text-sm">
          <span className={!yearly ? "font-semibold" : "text-[var(--muted2)]"}>รายเดือน</span>
          <button
            onClick={() => setYearly((v) => !v)}
            className={`relative h-7 w-14 rounded-full border transition-colors ${
              yearly ? "border-[var(--green)] bg-[var(--green)]" : "border-[var(--rule)] bg-[var(--paper-2)]"
            }`}
            role="switch"
            aria-checked={yearly}
            aria-label="สลับรายเดือน/รายปี"
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                yearly ? "left-8" : "left-1"
              }`}
            />
          </button>
          <span className={yearly ? "font-semibold" : "text-[var(--muted2)]"}>
            รายปี{" "}
            <span className="lp-mono rounded-full bg-[var(--gold)]/20 px-2 py-0.5 text-xs font-semibold text-[var(--gold-d)]">
              ประหยัด 2 เดือน
            </span>
          </span>
        </div>

        <div className="mt-10 grid items-stretch gap-6 lg:grid-cols-3">
          {TIERS.map((t) => {
            const price = yearly ? t.yearly : t.monthly;
            const per = t.monthly === 0 ? "" : yearly ? "บาท/ปี" : "บาท/เดือน";
            const dark = t.highlight;
            return (
              <div
                key={t.name}
                className={`relative flex flex-col rounded-3xl p-7 ${
                  dark
                    ? "bg-[var(--night)] text-white shadow-[0_34px_70px_-32px_rgba(11,43,29,0.8)]"
                    : "lp-card"
                }`}
              >
                {dark && (
                  <span className="lp-stamp absolute -top-3.5 right-6 text-xs">ยอดนิยม</span>
                )}
                <h3 className="lp-display text-xl font-semibold">{t.name}</h3>
                <p className={`text-sm ${dark ? "text-white/60" : "text-[var(--muted2)]"}`}>
                  {t.tagline}
                </p>

                <div className="lp-mono mt-6 flex items-baseline gap-2">
                  <span className={`text-4xl font-bold ${dark ? "text-[var(--gold)]" : ""}`}>
                    {price === 0 ? "ฟรี" : `฿${price.toLocaleString("th-TH")}`}
                  </span>
                  {per && (
                    <span className={`text-xs ${dark ? "text-white/60" : "text-[var(--muted2)]"}`}>
                      {per}
                    </span>
                  )}
                </div>

                <ul
                  className={`mt-6 flex-1 space-y-2.5 border-t pt-5 text-sm ${
                    dark ? "border-white/15" : "border-[var(--rule)]"
                  }`}
                >
                  {t.features.map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          dark ? "text-[var(--gold)]" : "text-[var(--green)]"
                        }`}
                        aria-hidden="true"
                      >
                        <path d="m5 12 5 5L20 7" />
                      </svg>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className={`mt-7 w-full ${dark ? "lp-btn-gold" : "lp-btn-ghost"}`}
                >
                  {t.cta}
                </Link>
              </div>
            );
          })}
        </div>

        {/* Enterprise */}
        <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-3xl border border-dashed border-[var(--rule)] bg-[var(--paper)] px-7 py-6 sm:flex-row">
          <div>
            <h3 className="lp-display text-lg font-semibold">องค์กรใหญ่ / เชน</h3>
            <p className="mt-1 text-sm text-[var(--muted2)]">
              สินค้าไม่จำกัด · API เชื่อมระบบ · สร้าง Role เอง · ผู้ดูแลเฉพาะ · SLA — ราคาตามขนาด
            </p>
          </div>
          <Link href="/signup" className="lp-btn-ghost shrink-0">
            ติดต่อเรา
          </Link>
        </div>
      </div>
    </section>
  );
}
