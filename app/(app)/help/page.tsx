import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/auth";
import { minRoleForPath, minPlanForPath, ROLE_LABELS } from "@/components/nav";
import { HELP_GROUPS, findTopic } from "./topics";
import TopicSelect from "./TopicSelect";

export const metadata: Metadata = { title: "วิธีใช้งาน" };

/** ป้ายกำกับสิทธิ์ของหัวข้อ — ดึงจากตารางสิทธิ์จริงใน nav.ts จะได้ไม่ต้องเขียนซ้ำ/หลุดซิงก์ */
function accessBadges(href?: string): string[] {
  if (!href) return [];
  const out: string[] = [];
  const role = minRoleForPath(href);
  if (role !== "cashier") out.push(`เฉพาะ${ROLE_LABELS[role]}ขึ้นไป`);
  const plan = minPlanForPath(href);
  if (plan === "pro") out.push("แพ็ก Pro ขึ้นไป");
  if (plan === "premium") out.push("แพ็ก Premium");
  return out;
}

export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/onboarding");

  const { t } = await searchParams;
  const topic = findTopic(t);
  const badges = accessBadges(topic.href);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">วิธีใช้งาน</h1>
      <p className="text-sm text-[var(--muted)]">
        คู่มือการใช้งานทุกหน้าในระบบ — เลือกหัวข้อที่อยากรู้ได้เลย · หัวข้อที่มี 📷
        มีภาพหน้าจอจริงพร้อมหมุดเลขชี้จุด
      </p>

      {/* จอเล็ก: เลือกหัวข้อจาก dropdown */}
      <div className="mt-4 lg:hidden">
        <TopicSelect groups={HELP_GROUPS} current={topic.slug} />
      </div>

      <div className="mt-4 grid items-start gap-6 lg:grid-cols-[240px_1fr]">
        {/* จอใหญ่: เมนูหัวข้อด้านซ้าย */}
        <aside className="sticky top-4 hidden max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-[var(--border)] bg-white p-3 lg:block">
          {HELP_GROUPS.map((g) => (
            <div key={g.title} className="mb-3 last:mb-0">
              <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                {g.title}
              </div>
              {g.topics.map((tp) => (
                <Link
                  key={tp.slug}
                  href={`/help?t=${tp.slug}`}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    tp.slug === topic.slug
                      ? "bg-[var(--primary)] text-white"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-xs">{tp.icon}</span>
                  <span className="truncate">{tp.title}</span>
                  {tp.image && (
                    <span
                      className={`ml-auto text-[10px] ${tp.slug === topic.slug ? "opacity-90" : "opacity-50"}`}
                      title="มีภาพหน้าจอประกอบ"
                    >
                      📷
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </aside>

        {/* เนื้อหาหัวข้อที่เลือก */}
        <article className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">
                <span className="mr-2">{topic.icon}</span>
                {topic.title}
              </h2>
              {badges.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {badges.map((b) => (
                    <span
                      key={b}
                      className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {topic.href && (
              <Link
                href={topic.href}
                className="btn-outline shrink-0 px-3 py-1.5 text-sm"
              >
                เปิดหน้านี้ →
              </Link>
            )}
          </div>

          <p className="mt-3 leading-relaxed text-slate-700">{topic.intro}</p>

          {/* ภาพหน้าจอจริง + หมุดตัวเลขชี้จุด */}
          {topic.image && (
            <figure className="mt-5">
              <div className="relative overflow-hidden rounded-lg border border-[var(--border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={topic.image.src}
                  alt={topic.image.alt}
                  className="block w-full"
                />
                {topic.image.callouts.map((c) => (
                  <span
                    key={c.n}
                    style={{ left: `${c.x}%`, top: `${c.y}%` }}
                    className="absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[var(--primary)] text-xs font-bold text-white shadow-lg ring-2 ring-white"
                    aria-hidden
                  >
                    {c.n}
                  </span>
                ))}
              </div>
              <figcaption className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {topic.image.callouts.map((c) => (
                  <span
                    key={c.n}
                    className="flex gap-2 text-sm leading-relaxed text-slate-600"
                  >
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-[10px] font-bold text-white">
                      {c.n}
                    </span>
                    <span>{c.label}</span>
                  </span>
                ))}
              </figcaption>
            </figure>
          )}

          {topic.steps && topic.steps.length > 0 && (
            <div className="mt-5">
              <h3 className="font-semibold">วิธีใช้งาน</h3>
              <ol className="mt-2 space-y-2">
                {topic.steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--primary)]/10 text-xs font-bold text-[var(--primary)]">
                      {i + 1}
                    </span>
                    <span className="pt-0.5 text-slate-700">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {topic.tips && topic.tips.length > 0 && (
            <div className="mt-5 rounded-lg bg-slate-50 p-4">
              <h3 className="text-sm font-semibold">💡 ควรรู้</h3>
              <ul className="mt-2 space-y-1.5">
                {topic.tips.map((tip, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-sm leading-relaxed text-slate-600"
                  >
                    <span className="text-[var(--muted)]">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
