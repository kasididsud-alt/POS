import Link from "next/link";
import { redirect } from "next/navigation";
import { query, one } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { formatTHB, formatDateTime } from "@/lib/format";
import type { Sale } from "@/lib/types";

const PAGE_SIZE = 50;
const PAY_LABEL: Record<string, string> = {
  cash: "เงินสด",
  promptpay: "พร้อมเพย์",
  credit: "ขายเชื่อ",
};

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/onboarding");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [sales, countRow] = await Promise.all([
    query<Sale>(
      "select * from sales where org_id = $1 order by created_at desc limit $2 offset $3",
      [ctx.org.id, PAGE_SIZE, offset],
    ),
    one<{ count: string }>("select count(*) from sales where org_id = $1", [
      ctx.org.id,
    ]),
  ]);

  const totalCount = Number(countRow?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div>
      <h1 className="text-2xl font-bold">ประวัติการขาย</h1>
      <p className="text-sm text-[var(--muted)]">
        ทั้งหมด {totalCount.toLocaleString("th-TH")} บิล · หน้า {page}/{totalPages}
      </p>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">เลขที่บิล</th>
              <th className="px-4 py-3">เวลา</th>
              <th className="px-4 py-3">ชำระโดย</th>
              <th className="px-4 py-3 text-right">ยอดสุทธิ</th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-[var(--muted)]">
                  ยังไม่มีการขาย
                </td>
              </tr>
            )}
            {sales.map((s) => (
              <tr
                key={s.id}
                className="border-b border-[var(--border)] last:border-0 hover:bg-slate-50"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/sales/${s.id}`}
                    className="font-medium text-[var(--primary)]"
                  >
                    {s.bill_no}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {formatDateTime(s.created_at)}
                </td>
                <td className="px-4 py-3">
                  {PAY_LABEL[s.payment_method] ?? s.payment_method}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatTHB(Number(s.total))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          {page > 1 ? (
            <Link href={`/sales?page=${page - 1}`} className="btn-outline">
              ← ก่อนหน้า
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-[var(--muted)]">
            หน้า {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={`/sales?page=${page + 1}`} className="btn-outline">
              ถัดไป →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
