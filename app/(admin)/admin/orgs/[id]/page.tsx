import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminOrgDetail } from "@/lib/admin-queries";
import { formatTHB, formatDate } from "@/lib/format";
import PlanBadge from "@/components/admin/PlanBadge";
import PlanEditor from "@/components/admin/PlanEditor";
import RoleEditor from "@/components/admin/RoleEditor";

export const dynamic = "force-dynamic";

export default async function AdminOrgDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getAdminOrgDetail(id);
  if (!detail) notFound();

  const { org, subscription, plan, members, productCount, salesCount, revenue } =
    detail;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/orgs"
          className="text-sm text-[var(--muted)] hover:underline"
        >
          ← ร้านค้าทั้งหมด
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">{org.name}</h1>
          <PlanBadge plan={plan} />
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          สร้างเมื่อ {formatDate(org.created_at)} · org id {org.id}
        </p>
      </div>

      {/* สถิติร้าน */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Mini label="สมาชิก" value={members.length.toString()} />
        <Mini label="สินค้า" value={productCount.toLocaleString()} />
        <Mini label="บิล" value={salesCount.toLocaleString()} />
        <Mini label="ยอดขายรวม" value={formatTHB(revenue)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* จัดการแพ็กเกจ */}
        <div className="card p-5">
          <h2 className="font-semibold">แพ็กเกจ / subscription</h2>
          <div className="mt-4">
            <PlanEditor
              orgId={org.id}
              plan={plan}
              compPlan={subscription?.comp_plan ?? null}
              status={subscription?.status ?? null}
              trialEndsAt={subscription?.trial_ends_at ?? null}
            />
          </div>
        </div>

        {/* สมาชิก + role */}
        <div className="card p-5">
          <h2 className="font-semibold">สมาชิก ({members.length})</h2>
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {members.map((m) => (
              <li
                key={m.user_id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{m.email}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {m.full_name ?? "—"} · เข้าร่วม {formatDate(m.created_at)}
                  </div>
                </div>
                <RoleEditor orgId={org.id} userId={m.user_id} role={m.role} />
              </li>
            ))}
            {members.length === 0 && (
              <li className="py-3 text-sm text-[var(--muted)]">
                ยังไม่มีสมาชิก
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-lg font-bold tracking-tight">{value}</div>
    </div>
  );
}
