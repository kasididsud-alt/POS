import Link from "next/link";
import { redirect } from "next/navigation";
import { query, one } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { getProductsWithStock } from "@/lib/queries";
import { formatTHB, formatDateTime } from "@/lib/format";
import type { Sale } from "@/lib/types";

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card p-5">
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-[var(--muted)]">{hint}</div>}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/onboarding");
  const orgId = ctx.org.id;
  const sp = await searchParams;

  const [todayRows, products, recent] = await Promise.all([
    query<{ total: string }>(
      "select total from sales where org_id = $1 and created_at::date = now()::date",
      [orgId],
    ),
    getProductsWithStock(orgId, ctx.branchId, { activeOnly: true }),
    query<Sale>(
      "select * from sales where org_id = $1 order by created_at desc limit 5",
      [orgId],
    ),
  ]);

  const todayTotal = todayRows.reduce((s, r) => s + Number(r.total), 0);
  const todayCount = todayRows.length;
  const lowStock = products.filter((p) => p.qty <= p.low_stock_threshold);

  // ข้อมูลเชิงต้นทุน/กำไร = เฉพาะเจ้าของร้าน (พนักงานไม่เห็น)
  const isOwner = ctx.membership?.role === "owner";
  const inventoryValue = products.reduce((s, p) => s + p.qty * Number(p.cost), 0);
  let todayProfit = 0;
  if (isOwner) {
    const cogsRow = await one<{ cogs: number }>(
      `select coalesce(sum(si.qty * si.cost_snapshot),0) as cogs
         from sale_items si join sales s on s.id = si.sale_id
        where s.org_id = $1 and s.created_at::date = now()::date`,
      [orgId],
    );
    todayProfit = todayTotal - Number(cogsRow?.cogs ?? 0);
  }

  return (
    <div className="space-y-6">
      {sp.denied && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          🔒 หน้านั้นเฉพาะเจ้าของร้านเท่านั้น
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ภาพรวม</h1>
        <Link href="/pos" className="btn-primary">
          + ขายสินค้า
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="ยอดขายวันนี้" value={formatTHB(todayTotal)} hint={`${todayCount} บิล`} />
        {isOwner ? (
          <Stat
            label="กำไรวันนี้ (ประมาณ)"
            value={formatTHB(todayProfit)}
            hint="คิดจากต้นทุน ณ เวลาขาย"
          />
        ) : (
          <Stat label="บิลวันนี้" value={`${todayCount} บิล`} />
        )}
        <Stat
          label="สินค้าใกล้หมด"
          value={`${lowStock.length} รายการ`}
          hint={lowStock.length ? "ควรเติมสต็อก" : "ปกติดี"}
        />
        {isOwner ? (
          <Stat label="มูลค่าสต็อก (ทุน)" value={formatTHB(inventoryValue)} />
        ) : (
          <Stat label="จำนวนสินค้า" value={`${products.length} รายการ`} />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold">⚠️ สินค้าใกล้หมด</h2>
          <div className="mt-3 space-y-2">
            {lowStock.length === 0 && (
              <p className="text-sm text-[var(--muted)]">ไม่มีสินค้าใกล้หมด 🎉</p>
            )}
            {lowStock.slice(0, 8).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span>{p.name}</span>
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                  เหลือ {p.qty} {p.unit}
                </span>
              </div>
            ))}
          </div>
          {lowStock.length > 0 && (
            <Link
              href="/products"
              className="mt-4 inline-block text-sm font-medium text-[var(--primary)]"
            >
              จัดการสต็อก →
            </Link>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-semibold">🧾 บิลล่าสุด</h2>
          <div className="mt-3 space-y-2">
            {recent.length === 0 && (
              <p className="text-sm text-[var(--muted)]">ยังไม่มีการขาย</p>
            )}
            {recent.map((s) => (
              <Link
                key={s.id}
                href={`/sales/${s.id}`}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
              >
                <div>
                  <div className="font-medium">{s.bill_no}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {formatDateTime(s.created_at)}
                  </div>
                </div>
                <span className="font-medium">{formatTHB(Number(s.total))}</span>
              </Link>
            ))}
          </div>
          <Link
            href="/sales"
            className="mt-4 inline-block text-sm font-medium text-[var(--primary)]"
          >
            ดูทั้งหมด →
          </Link>
        </div>
      </div>
    </div>
  );
}
