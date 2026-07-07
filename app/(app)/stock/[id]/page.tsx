import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { query, one } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import type { Product } from "@/lib/types";

const REASON_LABEL: Record<string, string> = {
  purchase: "รับเข้า",
  sale: "ขายออก",
  adjust: "ปรับยอด",
  return: "รับคืน",
  transfer: "โอนย้าย",
};

type Movement = {
  id: string;
  qty_change: number;
  reason: string;
  note: string | null;
  created_at: string;
};

export default async function StockHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/onboarding");

  const product = await one<Product & { qty: number }>(
    `select p.*, coalesce(ps.qty,0) as qty
       from products p left join product_stock ps on ps.product_id = p.id and ps.branch_id = $3
      where p.id = $1 and p.org_id = $2`,
    [id, ctx.org.id, ctx.branchId],
  );
  if (!product) notFound();

  const movements = await query<Movement>(
    `select id, qty_change, reason, note, created_at
       from stock_movements
      where product_id = $1 and org_id = $2 and branch_id = $3
      order by created_at desc limit 200`,
    [id, ctx.org.id, ctx.branchId],
  );

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/stock" className="text-sm text-[var(--primary)]">
        ← กลับคงคลัง
      </Link>

      <div className="card mt-3 p-5">
        <h1 className="text-xl font-bold">{product.name}</h1>
        <div className="mt-1 text-sm text-[var(--muted)]">
          คงเหลือปัจจุบัน:{" "}
          <span className="font-semibold text-foreground">
            {product.qty} {product.unit}
          </span>
        </div>
      </div>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">เวลา</th>
              <th className="px-4 py-3">ประเภท</th>
              <th className="px-4 py-3">หมายเหตุ</th>
              <th className="px-4 py-3 text-right">เปลี่ยนแปลง</th>
            </tr>
          </thead>
          <tbody>
            {movements.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-[var(--muted)]">
                  ยังไม่มีการเคลื่อนไหว
                </td>
              </tr>
            )}
            {movements.map((m) => (
              <tr key={m.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 text-[var(--muted)]">
                  {formatDateTime(m.created_at)}
                </td>
                <td className="px-4 py-3">{REASON_LABEL[m.reason] ?? m.reason}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{m.note || "—"}</td>
                <td
                  className={`px-4 py-3 text-right font-medium ${
                    m.qty_change >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {m.qty_change >= 0 ? "+" : ""}
                  {m.qty_change}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
