import Link from "next/link";
import { getAdminOverview, getAdminOrgs } from "@/lib/admin-queries";
import { adminEmails } from "@/lib/admin";
import { isStripeConfigured } from "@/lib/stripe";
import { googleConfigured } from "@/lib/oauth";
import { formatTHB, formatDate, formatDateTime } from "@/lib/format";
import PlanBadge from "@/components/admin/PlanBadge";
import OrgQuickManage from "@/components/admin/OrgQuickManage";
import { query } from "@/lib/db";
import { resolveContactMessage } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [o, allOrgs] = await Promise.all([
    getAdminOverview(),
    getAdminOrgs(q),
  ]);
  // ไม่ได้ค้นหา = โชว์ร้านล่าสุด 8 ร้านพอ / ค้นหา = โชว์ผลทั้งหมด (สูงสุด 20)
  const orgs = q ? allOrgs.slice(0, 20) : allOrgs.slice(0, 8);

  // ข้อความติดต่อทีมงานที่ยังไม่ปิดเรื่อง
  const contactMessages = await query<{
    id: string;
    topic: string;
    message: string;
    created_at: string;
    org_name: string;
    email: string | null;
  }>(
    `select m.id, m.topic, m.message, m.created_at, o.name as org_name, u.email
       from contact_messages m
       join organizations o on o.id = m.org_id
       left join users u on u.id = m.user_id
      where m.resolved_at is null
      order by m.created_at asc limit 50`,
  );

  const health = [
    { label: "ฐานข้อมูล", ok: true, note: "เชื่อมต่อได้" },
    {
      label: "Stripe",
      ok: isStripeConfigured,
      note: isStripeConfigured ? "ตั้งค่าแล้ว" : "ยังไม่ตั้งค่า (โหมดทดลอง)",
    },
    {
      label: "Google Sign-In",
      ok: googleConfigured(),
      note: googleConfigured() ? "ตั้งค่าแล้ว" : "ยังไม่ตั้งค่า",
    },
    {
      label: "ผู้ดูแลระบบ",
      ok: adminEmails().length > 0,
      note: `${adminEmails().length} อีเมล`,
    },
  ];

  const planTotal =
    o.planCounts.free + o.planCounts.pro + o.planCounts.premium || 1;
  const planSegments = [
    { id: "free", label: "ฟรี", count: o.planCounts.free, bar: "bg-slate-500" },
    { id: "pro", label: "Pro", count: o.planCounts.pro, bar: "bg-indigo-400" },
    {
      id: "premium",
      label: "Premium",
      count: o.planCounts.premium,
      bar: "bg-amber-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* แถบควบคุม: สถิติแพลตฟอร์ม + สัดส่วนแพ็กเกจ */}
      <section className="overflow-hidden rounded-2xl bg-slate-900 text-white shadow-md">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                ภาพรวมแพลตฟอร์ม
              </h1>
              <p className="mt-0.5 text-xs text-slate-400">
                สรุปสถานะทั้งระบบ ขายดี Stock
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              ระบบทำงานปกติ
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4">
            <HeroStat
              label="ผู้ใช้ทั้งหมด"
              value={o.totalUsers.toLocaleString()}
              sub={`+${o.newUsers7d} ใน 7 วัน`}
            />
            <HeroStat
              label="ร้านค้าทั้งหมด"
              value={o.totalOrgs.toLocaleString()}
              sub={`+${o.newOrgs7d} ใน 7 วัน`}
            />
            <HeroStat
              label="ยอดขายรวม"
              value={formatTHB(o.totalRevenue)}
              sub={`${o.totalSales.toLocaleString()} บิล`}
            />
            <HeroStat
              label="ยอดขายวันนี้"
              value={formatTHB(o.revenueToday)}
              sub={`${o.salesToday.toLocaleString()} บิล`}
              accent
            />
          </div>
        </div>

        {/* สัดส่วนแพ็กเกจ */}
        <div className="border-t border-slate-800 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-400">
              สัดส่วนแพ็กเกจร้านค้า
            </span>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
              {planSegments.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-sm ${s.bar}`} />
                  {s.label}{" "}
                  <span className="font-semibold text-white">{s.count}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-800">
            {planSegments.map(
              (s) =>
                s.count > 0 && (
                  <div
                    key={s.id}
                    className={s.bar}
                    style={{ width: `${(s.count / planTotal) * 100}%` }}
                    title={`${s.label}: ${s.count} ร้าน`}
                  />
                ),
            )}
          </div>
        </div>
      </section>

      {/* จัดการร้านค้า: เปลี่ยนแพ็กเกจ / เพิ่มวันทดลองใช้ ได้จากตรงนี้เลย */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="font-semibold">จัดการร้านค้า</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              ตั้งแพ็กเกจ (comp — ไม่ผ่าน Stripe) หรือเพิ่มวันทดลองใช้ได้ทันที
            </p>
          </div>
          <div className="flex items-center gap-2">
            <form className="flex gap-2">
              <input
                name="q"
                defaultValue={q ?? ""}
                placeholder="ค้นหาชื่อร้าน…"
                className="input w-44 sm:w-56"
              />
              <button type="submit" className="btn-primary px-3 py-2">
                ค้นหา
              </button>
            </form>
            <Link
              href="/admin/orgs"
              className="hidden text-sm font-medium text-[var(--primary)] hover:underline sm:inline"
            >
              ดูทั้งหมด
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-slate-50 text-left text-xs text-[var(--muted)]">
                <th className="px-5 py-2.5 font-medium">ร้าน</th>
                <th className="px-4 py-2.5 font-medium">แพ็กเกจปัจจุบัน</th>
                <th className="px-4 py-2.5 font-medium">
                  เปลี่ยนแพ็กเกจ / เพิ่มวัน
                </th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr
                  key={org.id}
                  className="border-b border-[var(--border)] align-top last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/orgs/${org.id}`}
                      className="font-medium text-[var(--primary)] hover:underline"
                    >
                      {org.name}
                    </Link>
                    <div className="mt-0.5 text-xs text-[var(--muted)]">
                      {org.members} สมาชิก · สมัคร {formatDate(org.created_at)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <PlanBadge plan={org.plan} />
                      {org.comp_plan && (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          comp
                        </span>
                      )}
                    </div>
                    <TrialNote status={org.status} endsAt={org.trial_ends_at} />
                  </td>
                  <td className="px-4 py-3">
                    <OrgQuickManage
                      orgId={org.id}
                      plan={org.plan}
                      compPlan={org.comp_plan}
                    />
                  </td>
                </tr>
              ))}
              {orgs.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-5 py-8 text-center text-[var(--muted)]"
                  >
                    {q ? `ไม่พบร้านชื่อ “${q}”` : "ยังไม่มีร้านค้า"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!q && allOrgs.length > orgs.length && (
          <div className="border-t border-[var(--border)] px-5 py-3 text-center">
            <Link
              href="/admin/orgs"
              className="text-sm font-medium text-[var(--primary)] hover:underline"
            >
              ดูร้านทั้งหมด {allOrgs.length} ร้าน →
            </Link>
          </div>
        )}
      </section>

      {/* ข้อความติดต่อทีมงาน */}
      <section className="card p-5">
        <h2 className="font-semibold">
          📨 ข้อความติดต่อทีมงาน{" "}
          {contactMessages.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {contactMessages.length} รอตอบ
            </span>
          )}
        </h2>
        {contactMessages.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">ไม่มีข้อความค้าง 🎉</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {contactMessages.map((m) => (
              <li key={m.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {m.topic} — {m.org_name}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--muted)]">
                      {m.message}
                    </p>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      {m.email ?? "ไม่ทราบผู้ส่ง"} · {formatDateTime(m.created_at)}
                    </div>
                  </div>
                  <form
                    action={async () => {
                      "use server";
                      await resolveContactMessage(m.id);
                    }}
                  >
                    <button className="btn-outline shrink-0 px-3 py-1 text-xs">
                      ปิดเรื่อง
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Health */}
        <section className="card p-5">
          <h2 className="font-semibold">สถานะระบบ</h2>
          <ul className="mt-3 space-y-2">
            {health.map((h) => (
              <li
                key={h.label}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      h.ok ? "bg-green-500" : "bg-amber-500"
                    }`}
                  />
                  {h.label}
                </span>
                <span className="text-[var(--muted)]">{h.note}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ผู้ใช้ล่าสุด */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">ผู้ใช้ที่สมัครล่าสุด</h2>
            <Link
              href="/admin/users"
              className="text-sm font-medium text-[var(--primary)] hover:underline"
            >
              ดูทั้งหมด
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {o.recentUsers.map((u) => (
              <li key={u.id} className="flex items-center justify-between py-2">
                <span className="min-w-0 truncate text-sm font-medium">
                  {u.email}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-[var(--muted)]">
                  {u.google_sub && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5">
                      Google
                    </span>
                  )}
                  {formatDate(u.created_at)}
                </span>
              </li>
            ))}
            {o.recentUsers.length === 0 && (
              <li className="py-2 text-sm text-[var(--muted)]">ยังไม่มีผู้ใช้</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

function HeroStat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-400">{label}</div>
      <div
        className={`mt-1 text-2xl font-bold tracking-tight tabular-nums ${
          accent ? "text-emerald-400" : "text-white"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

/** หมายเหตุสถานะ subscription ใต้ป้ายแพ็กเกจ (เช่น วันหมดทดลองใช้) */
function TrialNote({
  status,
  endsAt,
}: {
  status: string | null;
  endsAt: string | null;
}) {
  if (status === "trialing" && endsAt) {
    const expired = new Date(endsAt).getTime() < Date.now();
    return (
      <div
        className={`mt-1 text-xs ${expired ? "text-red-600" : "text-[var(--muted)]"}`}
      >
        {expired ? "ทดลองหมดแล้ว" : "ทดลองถึง"} {formatDate(endsAt)}
      </div>
    );
  }
  if (status)
    return <div className="mt-1 text-xs text-[var(--muted)]">{status}</div>;
  return (
    <div className="mt-1 text-xs text-[var(--muted)]">ไม่มี subscription</div>
  );
}
