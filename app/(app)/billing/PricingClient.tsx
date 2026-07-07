"use client";

import Link from "next/link";
import { useState } from "react";

export type ClientPlan = {
  id: "free" | "pro" | "premium";
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  features: string[];
  highlight?: boolean;
};

const RANK: Record<string, number> = { free: 0, pro: 1, premium: 2 };

export default function PricingClient({
  free,
  paid,
  current,
  isOwner,
  stripeReady,
  banner,
  errorMsg,
  upgradeNeed,
}: {
  free: ClientPlan;
  paid: ClientPlan[];
  current: "free" | "pro" | "premium";
  isOwner: boolean;
  stripeReady: boolean;
  banner: "success" | "canceled" | "error" | "upgrade" | null;
  errorMsg: string | null;
  upgradeNeed: "pro" | "premium" | null;
}) {
  const [yearly, setYearly] = useState(false);
  const interval = yearly ? "yearly" : "monthly";

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">แพ็กเกจ &amp; ราคา</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        เลือกแพ็กที่พอดีกับร้าน · อัปเกรด/ดาวน์เกรดเมื่อไหร่ก็ได้
      </p>

      {banner === "upgrade" && (
        <div className="mt-4 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
          🔒 ฟีเจอร์นี้ต้องใช้แพ็ก
          {upgradeNeed === "premium" ? " มืออาชีพ " : " ร้านค้า "}
          ขึ้นไป — อัปเกรดเพื่อปลดล็อก
        </div>
      )}
      {banner === "success" && (
        <div className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          ✅ สมัคร/เปลี่ยนแพ็กเกจสำเร็จ ขอบคุณครับ
        </div>
      )}
      {banner === "canceled" && (
        <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ยกเลิกการชำระเงินแล้ว — ยังไม่มีการเรียกเก็บเงิน
        </div>
      )}
      {banner === "error" && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMsg ?? "เกิดข้อผิดพลาด"}
        </div>
      )}

      {!stripeReady && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          โหมด local — ยังไม่ได้เปิด Stripe จึงยังกดชำระเงินจริงไม่ได้
          (ทุกร้านใช้ทดลองฟรีได้เลย) ตอนขึ้น prod ใส่ STRIPE_SECRET_KEY + Price ID
          ของแต่ละแพ็กเพื่อเปิดการชำระเงิน
        </p>
      )}
      {stripeReady && !isOwner && (
        <p className="mt-4 rounded-lg bg-[var(--surface-1,#f5f5f5)] px-3 py-2 text-sm text-[var(--muted)]">
          เฉพาะเจ้าของร้านเท่านั้นที่เปลี่ยนแพ็กเกจได้
        </p>
      )}

      {/* toggle รายเดือน/รายปี */}
      <div className="mt-6 flex items-center gap-3 text-sm">
        <span className={!yearly ? "font-semibold" : "text-[var(--muted)]"}>รายเดือน</span>
        <button
          type="button"
          onClick={() => setYearly((v) => !v)}
          className="relative h-7 w-14 rounded-full border border-[var(--border,#ddd)] bg-white transition"
          aria-label="สลับรายเดือน/รายปี"
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-[var(--primary,#0e7a43)] transition-all ${
              yearly ? "left-8" : "left-1"
            }`}
          />
        </button>
        <span className={yearly ? "font-semibold" : "text-[var(--muted)]"}>
          รายปี{" "}
          <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
            ประหยัด 2 เดือน
          </span>
        </span>
      </div>

      <div className="mt-6 grid items-start gap-4 md:grid-cols-3">
        {[free, ...paid].map((p) => {
          const price = yearly ? p.yearly : p.monthly;
          const per = p.monthly === 0 ? "" : yearly ? "บาท/ปี" : "บาท/เดือน";
          const isCurrent = current === p.id;
          const isDowngrade = RANK[p.id] < RANK[current];

          return (
            <div
              key={p.id}
              className={`card relative p-6 ${
                p.highlight ? "ring-2 ring-[var(--primary,#0e7a43)]" : ""
              }`}
            >
              {isCurrent && (
                <span className="absolute right-4 top-4 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  แพ็กปัจจุบัน
                </span>
              )}

              <h3 className="text-lg font-bold">{p.name}</h3>
              <p className="text-sm text-[var(--muted)]">{p.tagline}</p>

              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-bold">
                  {price === 0 ? "ฟรี" : `฿${price.toLocaleString("th-TH")}`}
                </span>
                {per && <span className="text-xs text-[var(--muted)]">{per}</span>}
              </div>

              <ul className="mt-5 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-[var(--primary,#0e7a43)]">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {p.id === "free" ? (
                  <button
                    className="btn-outline w-full"
                    disabled
                    title={isCurrent ? "แพ็กปัจจุบัน" : "แพ็กพื้นฐาน"}
                  >
                    {isCurrent ? "แพ็กปัจจุบัน" : "แพ็กพื้นฐาน"}
                  </button>
                ) : isCurrent ? (
                  <button className="btn-outline w-full" disabled>
                    แพ็กปัจจุบัน
                  </button>
                ) : (
                  <form action="/api/stripe/checkout" method="POST">
                    <input type="hidden" name="plan" value={p.id} />
                    <input type="hidden" name="interval" value={interval} />
                    <button
                      className={`w-full ${p.highlight ? "btn-primary" : "btn-outline"}`}
                      disabled={!isOwner || !stripeReady}
                    >
                      {isDowngrade ? "เปลี่ยนเป็นแพ็กนี้" : "อัปเกรดเป็นแพ็กนี้"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* องค์กรใหญ่ / เชน */}
      <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-xl border border-dashed border-[var(--border,#ddd)] px-6 py-5 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-base font-bold">องค์กรใหญ่ / เชน</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            สินค้าไม่จำกัด · API เชื่อมระบบ · สร้าง Role เอง · ผู้ดูแลเฉพาะ · SLA — ราคาตามขนาด
          </p>
        </div>
        <Link href="/settings" className="btn-outline whitespace-nowrap">
          ติดต่อเรา
        </Link>
      </div>
    </div>
  );
}
