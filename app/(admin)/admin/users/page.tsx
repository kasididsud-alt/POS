import Link from "next/link";
import { getAdminUsers } from "@/lib/admin-queries";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const users = await getAdminUsers(q);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">ผู้ใช้</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {users.length} คน{q ? ` — ค้นหา “${q}”` : ""}
          </p>
        </div>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="ค้นหาอีเมล…"
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
                <th className="px-4 py-3 font-medium">อีเมล</th>
                <th className="px-4 py-3 font-medium">ชื่อ</th>
                <th className="px-4 py-3 font-medium">เข้าสู่ระบบ</th>
                <th className="px-4 py-3 font-medium">ร้าน / สิทธิ์</th>
                <th className="px-4 py-3 font-medium">สมัครเมื่อ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium">{u.email}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {u.full_name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        u.google_sub
                          ? "bg-slate-100 text-slate-700"
                          : "bg-slate-50 text-[var(--muted)]"
                      }`}
                    >
                      {u.google_sub ? "Google" : "รหัสผ่าน"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.memberships.length === 0 ? (
                      <span className="text-[var(--muted)]">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {u.memberships.map((m) => (
                          <Link
                            key={m.org_id}
                            href={`/admin/orgs/${m.org_id}`}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs hover:bg-slate-200"
                          >
                            {m.org_name}
                            <span className="ml-1 text-[var(--muted)]">
                              · {m.role === "owner" ? "เจ้าของ" : "พนักงาน"}
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {formatDate(u.created_at)}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-[var(--muted)]"
                  >
                    ไม่พบผู้ใช้
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
