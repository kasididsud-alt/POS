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
      "ตรวจนับ + ตำแหน่งจัดเก็บ + ล็อต (FEFO)",
      "ใบสั่งซื้อ (PO) + ซัพพลายเออร์",
      "ลูกหนี้/ขายเชื่อ + VAT + Export",
      "สิทธิ์ละเอียด + audit log",
    ],
  },
];

export default function Pricing() {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-5 py-20">
      <div className="lp-mono text-xs text-[var(--green-d)]">{"// ราคา"}</div>
      <h2 className="lp-display mt-2 text-3xl font-bold sm:text-4xl">
        เลือกแพ็กที่พอดีกับร้าน
      </h2>
      <p className="mt-3 text-[var(--muted2)]">
        เริ่มฟรี ไม่ต้องใช้บัตรเครดิต · ยกเลิกเมื่อไหร่ก็ได้
      </p>

      {/* toggle */}
      <div className="lp-mono mt-7 flex items-center gap-3 text-sm">
        <span className={!yearly ? "font-bold" : "text-[var(--muted2)]"}>รายเดือน</span>
        <button
          onClick={() => setYearly((v) => !v)}
          className="relative h-7 w-14 rounded-full border border-[var(--rule)] bg-white transition"
          aria-label="สลับรายเดือน/รายปี"
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-[var(--green)] transition-all ${
              yearly ? "left-8" : "left-1"
            }`}
          />
        </button>
        <span className={yearly ? "font-bold" : "text-[var(--muted2)]"}>
          รายปี{" "}
          <span className="rounded bg-[var(--green)]/10 px-1.5 py-0.5 text-xs text-[var(--green-d)]">
            ประหยัด 2 เดือน
          </span>
        </span>
      </div>

      <div className="mt-10 grid items-start gap-6 lg:grid-cols-3">
        {TIERS.map((t) => {
          const price = yearly ? t.yearly : t.monthly;
          const per = t.monthly === 0 ? "" : yearly ? "บาท/ปี" : "บาท/เดือน";
          return (
            <div
              key={t.name}
              className={`lp-ticket relative p-7 ${
                t.highlight
                  ? "shadow-[0_24px_60px_-30px_rgba(14,122,67,0.6)] ring-2 ring-[var(--green)]"
                  : "ring-1 ring-[var(--rule)]"
              }`}
            >
              {t.highlight && (
                <span className="lp-stamp absolute -right-2 top-4 text-[10px]">
                  ขายดี
                </span>
              )}
              <h3 className="lp-display text-xl font-bold">{t.name}</h3>
              <p className="text-sm text-[var(--muted2)]">{t.tagline}</p>

              <div className="lp-perf my-5" />

              <div className="lp-mono flex items-baseline gap-2">
                <span className="text-4xl font-bold">
                  {price === 0 ? "ฟรี" : `฿${price.toLocaleString("th-TH")}`}
                </span>
                {per && <span className="text-xs text-[var(--muted2)]">{per}</span>}
              </div>

              <ul className="mt-6 space-y-2.5 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-[var(--green)]">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`mt-7 w-full ${t.highlight ? "lp-btn-solid" : "lp-btn-ghost"}`}
              >
                {t.cta}
              </Link>
            </div>
          );
        })}
      </div>

      {/* Enterprise */}
      <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-xl border border-dashed border-[var(--rule)] bg-white px-7 py-6 sm:flex-row">
        <div>
          <h3 className="lp-display text-lg font-bold">องค์กรใหญ่ / เชน</h3>
          <p className="mt-1 text-sm text-[var(--muted2)]">
            สินค้าไม่จำกัด · API เชื่อมระบบ · สร้าง Role เอง · ผู้ดูแลเฉพาะ · SLA — ราคาตามขนาด
          </p>
        </div>
        <Link href="/signup" className="lp-btn-ghost">
          ติดต่อเรา
        </Link>
      </div>
    </section>
  );
}
