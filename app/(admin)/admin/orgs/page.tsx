import Link from "next/link";
import { getAdminOrgs } from "@/lib/admin-queries";
import { formatTHB, formatDate } from "@/lib/format";
import PlanBadge from "@/components/admin/PlanBadge";
import OrgQuickManage from "@/components/admin/OrgQuickManage";

export const dynamic = "force-dynamic";

export default async function AdminOrgsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const orgs = await getAdminOrgs(q);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">ร้านค้า</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {orgs.length} ร้าน{q ? ` — ค้นหา “${q}”` : ""}
          </p>
        </div>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="ค้นหาชื่อร้าน…"
            className="input w-56"
          />
          <button type="submit" className="btn-primary">
            ค้นหา
          </button>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                <th className="px-4 py-3 font-medium">ร้าน</th>
                <th className="px-4 py-3 font-medium">แพ็กเกจ</th>
                <th className="px-4 py-3 text-right font-medium">สมาชิก</th>
                <th className="px-4 py-3 text-right font-medium">บิล</th>
                <th className="px-4 py-3 text-right font-medium">ยอดขาย</th>
                <th className="px-4 py-3 font-medium">สมัครเมื่อ</th>
                <th className="px-4 py-3 font-medium">
                  เปลี่ยนแพ็กเกจ / เพิ่มวัน
                </th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orgs/${o.id}`}
                      className="font-medium text-[var(--primary)] hover:underline"
                    >
                      {o.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <PlanBadge plan={o.plan} />
                      {o.comp_plan && (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          comp
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {o.members}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {o.sales_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatTHB(o.revenue)}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {formatDate(o.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <OrgQuickManage
                      orgId={o.id}
                      plan={o.plan}
                      compPlan={o.comp_plan}
                    />
                  </td>
                </tr>
              ))}
              {orgs.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-[var(--muted)]"
                  >
                    ไม่พบร้านค้า
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
