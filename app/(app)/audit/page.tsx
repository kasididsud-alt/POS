import { requireOwnerPage } from "@/lib/guard";
import { query } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

const ACTION_LABEL: Record<string, string> = {
  "product.create": "เพิ่มสินค้า",
  "product.update": "แก้ไขสินค้า",
  "product.delete": "ลบสินค้า",
  "stock.purchase": "รับสต็อก",
  "stock.adjust": "ปรับสต็อก",
  "stock.return": "รับคืนสต็อก",
};

type LogRow = {
  id: string;
  action: string;
  detail: string | null;
  created_at: string;
  email: string | null;
};

export default async function AuditPage() {
  const ctx = await requireOwnerPage();

  const logs = await query<LogRow>(
    `select a.id, a.action, a.detail, a.created_at, u.email
       from audit_logs a left join users u on u.id = a.user_id
      where a.org_id = $1
      order by a.created_at desc limit 200`,
    [ctx.org.id],
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">บันทึกการใช้งาน</h1>
      <p className="text-sm text-[var(--muted)]">
        ประวัติการกระทำสำคัญในระบบ (200 รายการล่าสุด)
      </p>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">เวลา</th>
              <th className="px-4 py-3">ผู้ใช้</th>
              <th className="px-4 py-3">การกระทำ</th>
              <th className="px-4 py-3">รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-[var(--muted)]">
                  ยังไม่มีบันทึก
                </td>
              </tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 text-[var(--muted)]">
                  {formatDateTime(l.created_at)}
                </td>
                <td className="px-4 py-3">{l.email ?? "—"}</td>
                <td className="px-4 py-3">{ACTION_LABEL[l.action] ?? l.action}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{l.detail ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
