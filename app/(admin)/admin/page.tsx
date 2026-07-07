import Link from "next/link";
import { getAdminOverview } from "@/lib/admin-queries";
import { adminEmails } from "@/lib/admin";
import { isStripeConfigured } from "@/lib/stripe";
import { googleConfigured } from "@/lib/oauth";
import { formatTHB, formatDate } from "@/lib/format";
import PlanBadge from "@/components/admin/PlanBadge";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const o = await getAdminOverview();

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">ภาพรวมระบบ</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          สรุปสถานะทั้งแพลตฟอร์ม
        </p>
      </div>

      {/* สถิติหลัก */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="ผู้ใช้ทั้งหมด"
          value={o.totalUsers.toLocaleString()}
          sub={`+${o.newUsers7d} ใน 7 วัน`}
        />
        <Stat
          label="ร้านค้าทั้งหมด"
          value={o.totalOrgs.toLocaleString()}
          sub={`+${o.newOrgs7d} ใน 7 วัน`}
        />
        <Stat
          label="ยอดขายรวม"
          value={formatTHB(o.totalRevenue)}
          sub={`${o.totalSales.toLocaleString()} บิล`}
        />
        <Stat
          label="ยอดขายวันนี้"
          value={formatTHB(o.revenueToday)}
          sub={`${o.salesToday.toLocaleString()} บิล`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* แพ็กเกจ + สถานะ */}
        <div className="card p-5">
          <h2 className="font-semibold">แพ็กเกจร้านค้า</h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <PlanCount label="ฟรี" value={o.planCounts.free} />
            <PlanCount label="Pro" value={o.planCounts.pro} />
            <PlanCount label="Premium" value={o.planCounts.premium} />
          </div>
          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <div className="text-xs font-medium text-[var(--muted)]">
              สถานะ subscription
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(o.statusCounts).length === 0 && (
                <span className="text-sm text-[var(--muted)]">—</span>
              )}
              {Object.entries(o.statusCounts).map(([s, n]) => (
                <span
                  key={s}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {s}: {n}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Health */}
        <div className="card p-5">
          <h2 className="font-semibold">สถานะระบบ</h2>
          <ul className="mt-3 space-y-2">
            {health.map((h) => (
              <li
                key={h.label}
                className="flex items-center justify-between text-sm"
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
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ร้านล่าสุด */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">ร้านที่สมัครล่าสุด</h2>
            <Link
              href="/admin/orgs"
              className="text-sm font-medium text-[var(--primary)] hover:underline"
            >
              ดูทั้งหมด
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {o.recentOrgs.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <Link
                  href={`/admin/orgs/${r.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {r.name}
                </Link>
                <span className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <PlanBadge plan={r.plan} />
                  {formatDate(r.created_at)}
                </span>
              </li>
            ))}
            {o.recentOrgs.length === 0 && (
              <li className="py-2 text-sm text-[var(--muted)]">ยังไม่มีร้าน</li>
            )}
          </ul>
        </div>

        {/* ผู้ใช้ล่าสุด */}
        <div className="card p-5">
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
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-[var(--muted)]">{sub}</div>}
    </div>
  );
}

function PlanCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 text-center">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-[var(--muted)]">{label}</div>
    </div>
  );
}
