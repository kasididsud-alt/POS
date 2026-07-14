"use client";

import Link from "next/link";
import { useState } from "react";
import type { PublicPlanDef } from "@/lib/plans";

export default function Pricing({
  tiers,
}: Readonly<{ tiers: readonly PublicPlanDef[] }>) {
  const [yearly, setYearly] = useState(false);

  return (
    <section
      id="pricing"
      className="border-y border-[var(--lp-rule,var(--rule))] bg-[var(--paper)]"
    >
      <div className="mx-auto max-w-6xl px-5 py-20">
        <span className="lp-eyebrow">ราคา</span>
        <h2 className="lp-display mt-3 max-w-2xl text-3xl font-bold text-[var(--lp-ink,var(--ink))] sm:text-4xl">
          เลือกแพ็กที่พอดีกับร้าน
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--lp-muted,var(--muted2))]">
          เริ่มฟรี ไม่ต้องใช้บัตรเครดิต · ยกเลิกเมื่อไหร่ก็ได้
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3 text-base">
          <span
            className={
              !yearly
                ? "font-semibold text-[var(--lp-ink,var(--ink))]"
                : "text-[var(--lp-muted,var(--muted2))]"
            }
          >
            รายเดือน
          </span>
          <button
            type="button"
            onClick={() => setYearly((v) => !v)}
            className={`relative h-11 w-[4.5rem] shrink-0 rounded-full border-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--lp-night,#06152b)] focus-visible:ring-offset-2 ${
              yearly
                ? "border-[var(--lp-mint,#42e6ad)] bg-[var(--lp-mint,#42e6ad)]"
                : "border-[var(--lp-rule,var(--rule))] bg-[var(--lp-surface,#ffffff)]"
            }`}
            role="switch"
            aria-checked={yearly}
            aria-label="สลับรายเดือน/รายปี"
          >
            <span
              aria-hidden="true"
              className={`absolute left-1.5 top-1.5 h-7 w-7 rounded-full bg-[var(--lp-night,#06152b)] shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none ${
                yearly ? "translate-x-7" : "translate-x-0"
              }`}
            />
          </button>
          <span
            className={
              yearly
                ? "font-semibold text-[var(--lp-ink,var(--ink))]"
                : "text-[var(--lp-muted,var(--muted2))]"
            }
          >
            รายปี{" "}
            <span className="lp-mono inline-flex min-h-7 items-center rounded-full bg-[var(--lp-mint,#42e6ad)] px-2.5 text-sm font-semibold text-[var(--lp-night,#06152b)]">
              ประหยัด 2 เดือน
            </span>
          </span>
        </div>

        <div className="mt-10 grid items-stretch gap-6 lg:grid-cols-3">
          {tiers.map((tier) => {
            const price = yearly ? tier.yearly : tier.monthly;
            const period =
              tier.monthly === 0 ? "" : yearly ? "บาท/ปี" : "บาท/เดือน";
            const highlighted = tier.highlight === true;
            const cta = tier.id === "free" ? "เริ่มใช้ฟรี" : "ทดลองฟรี 14 วัน";

            return (
              <article
                key={tier.id}
                className={`relative flex flex-col overflow-hidden rounded-[1.75rem] border p-7 sm:p-8 ${
                  highlighted
                    ? "border-[var(--lp-night,#06152b)] bg-[var(--lp-night,#06152b)] text-white shadow-[0_28px_70px_-38px_rgba(6,21,43,0.95)]"
                    : "border-[var(--lp-rule,var(--rule))] bg-[var(--lp-surface,#ffffff)] text-[var(--lp-ink,var(--ink))] shadow-[0_24px_60px_-42px_rgba(7,24,47,0.45)]"
                }`}
              >
                {highlighted ? (
                  <span className="absolute right-6 top-6 inline-flex min-h-8 items-center rounded-full bg-[var(--lp-mint,#42e6ad)] px-3 text-sm font-bold text-[var(--lp-night,#06152b)]">
                    ยอดนิยม
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-1 bg-[var(--lp-blue,#4db8ff)]"
                  />
                )}
                <h3 className="lp-display pr-24 text-2xl font-semibold">
                  {tier.name}
                </h3>
                <p
                  className={`mt-2 text-base leading-7 ${
                    highlighted
                      ? "text-white/80"
                      : "text-[var(--lp-muted,var(--muted2))]"
                  }`}
                >
                  {tier.tagline}
                </p>

                <div className="lp-mono mt-7 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span
                    className={`text-4xl font-bold sm:text-5xl ${
                      highlighted
                        ? "text-[var(--lp-mint,#42e6ad)]"
                        : "text-[var(--lp-night,#06152b)]"
                    }`}
                  >
                    {price === 0 ? "ฟรี" : `฿${price.toLocaleString("th-TH")}`}
                  </span>
                  {period && (
                    <span
                      className={`text-base ${
                        highlighted
                          ? "text-white/80"
                          : "text-[var(--lp-muted,var(--muted2))]"
                      }`}
                    >
                      {period}
                    </span>
                  )}
                </div>

                <ul
                  className={`mt-7 flex-1 space-y-3 border-t pt-6 text-base leading-7 ${
                    highlighted
                      ? "border-white/25"
                      : "border-[var(--lp-rule,var(--rule))]"
                  }`}
                >
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex gap-3">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`mt-1 h-5 w-5 shrink-0 ${
                          highlighted
                            ? "text-[var(--lp-mint,#42e6ad)]"
                            : "text-[var(--lp-mint-ink,#07543d)]"
                        }`}
                        aria-hidden="true"
                      >
                        <path d="m5 12 5 5L20 7" />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className={`mt-8 inline-flex min-h-11 min-w-11 w-full items-center justify-center rounded-xl border px-5 py-3 text-center text-base font-bold transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--lp-night,#06152b)] focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none ${
                    highlighted
                      ? "border-[var(--lp-mint,#42e6ad)] bg-[var(--lp-mint,#42e6ad)] text-[var(--lp-night,#06152b)]"
                      : "border-[var(--lp-night,#06152b)] bg-[var(--lp-night,#06152b)] text-white"
                  }`}
                >
                  {cta}
                </Link>
              </article>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col items-start justify-between gap-5 rounded-[1.75rem] border border-dashed border-[var(--lp-blue,#4db8ff)] bg-[var(--lp-surface,#ffffff)] px-7 py-7 sm:flex-row sm:items-center">
          <div>
            <h3 className="lp-display text-xl font-semibold text-[var(--lp-ink,var(--ink))]">
              องค์กรใหญ่ / เชน
            </h3>
            <p className="mt-2 max-w-3xl text-base leading-7 text-[var(--lp-muted,var(--muted2))]">
              สินค้าไม่จำกัด · API เชื่อมระบบ · หลายสาขาไม่จำกัด · ผู้ดูแลเฉพาะ · SLA — ราคาตามขนาด
            </p>
          </div>
          <Link
            href="/signup"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--lp-night,#06152b)] bg-[var(--lp-surface,#ffffff)] px-5 py-3 text-base font-bold text-[var(--lp-night,#06152b)] transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--lp-night,#06152b)] focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
          >
            ติดต่อเรา
          </Link>
        </div>
      </div>
    </section>
  );
}
