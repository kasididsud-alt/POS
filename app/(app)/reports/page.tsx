import Link from "next/link";
import { requireOwnerPage } from "@/lib/guard";
import { query } from "@/lib/db";
import { formatTHB } from "@/lib/format";

type Range = "today" | "7d" | "30d" | "month";

const RANGES: { key: Range; label: string; days: number }[] = [
  { key: "today", label: "วันนี้", days: 1 },
  { key: "7d", label: "7 วัน", days: 7 },
  { key: "30d", label: "30 วัน", days: 30 },
  { key: "month", label: "เดือนนี้", days: 0 },
];

/** จำนวนวันที่ครอบคลุมของช่วงที่เลือก (เดือนนี้ = ตั้งแต่วันที่ 1 ถึงวันนี้) */
function rangeDays(r: { key: Range; days: number }): number {
  return r.key === "month" ? new Date().getDate() : r.days;
}

function rangeStart(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString();
}

/** สร้างรายชื่อวันที่ตั้งแต่ start ถึงวันนี้ (YYYY-MM-DD) */
function dateKeys(days: number): string[] {
  const keys: string[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    keys.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return keys;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-[var(--muted)]">{hint}</div>}
    </div>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: Range }>;
}) {
  const ctx = await requireOwnerPage();
  const orgId = ctx.org.id;

  const sp = await searchParams;
  const active = RANGES.find((r) => r.key === sp.range) ?? RANGES[1];
  const days = rangeDays(active);
  const start = rangeStart(days);

  const [kpiRows, itemRows, dailyRows, topRows, payRows, cashierRows] = await Promise.all([
    query<{ revenue: number; bills: string; discount: number }>(
      "select coalesce(sum(total),0) revenue, count(*) bills, coalesce(sum(discount),0) discount from sales where org_id=$1 and created_at>=$2",
      [orgId, start],
    ),
    query<{ qty_sold: string; cogs: number }>(
      `select coalesce(sum(si.qty),0) qty_sold,
              coalesce(sum(si.qty * si.cost_snapshot),0) cogs
         from sale_items si
         join sales s on s.id = si.sale_id
        where s.org_id=$1 and s.created_at>=$2`,
      [orgId, start],
    ),
    query<{ d: string; total: number }>(
      "select to_char(created_at::date,'YYYY-MM-DD') d, sum(total) total from sales where org_id=$1 and created_at>=$2 group by 1",
      [orgId, start],
    ),
    query<{ name: string; qty: string; revenue: number }>(
      `select coalesce(si.name_snapshot, p.name) name, sum(si.qty) qty, sum(si.line_total) revenue
         from sale_items si
         join sales s on s.id = si.sale_id
         left join products p on p.id = si.product_id
        where s.org_id=$1 and s.created_at>=$2
        group by 1 order by qty desc limit 8`,
      [orgId, start],
    ),
    query<{ payment_method: string; bills: string; total: number }>(
      "select payment_method, count(*) bills, sum(total) total from sales where org_id=$1 and created_at>=$2 group by 1",
      [orgId, start],
    ),
    query<{ cashier: string; bills: string; total: number }>(
      `select coalesce(u.full_name, u.email, 'ไม่ระบุ') cashier,
              count(*) bills, sum(s.total) total
         from sales s
         left join users u on u.id = s.cashier_id
        where s.org_id=$1 and s.created_at>=$2
        group by 1 order by total desc`,
      [orgId, start],
    ),
  ]);

  const revenue = Number(kpiRows[0]?.revenue ?? 0);
  const bills = Number(kpiRows[0]?.bills ?? 0);
  const qtySold = Number(itemRows[0]?.qty_sold ?? 0);
  const cogs = Number(itemRows[0]?.cogs ?? 0);
  const profit = revenue - cogs;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  const dailyMap = new Map(dailyRows.map((r) => [r.d, Number(r.total)]));
  const series = dateKeys(days).map((d) => ({
    d,
    total: dailyMap.get(d) ?? 0,
  }));
  const maxDaily = Math.max(1, ...series.map((s) => s.total));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">รายงาน</h1>
        <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-white p-1">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/reports?range=${r.key}`}
              className={`rounded-md px-3 py-1 text-sm ${
                r.key === active.key
                  ? "bg-[var(--primary)] text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="ยอดขาย" value={formatTHB(revenue)} hint={`${bills} บิล`} />
        <Stat
          label="กำไรขั้นต้น (ประมาณ)"
          value={formatTHB(profit)}
          hint={`มาร์จิน ${margin.toFixed(1)}%`}
        />
        <Stat label="ต้นทุนขาย (ประมาณ)" value={formatTHB(cogs)} />
        <Stat label="จำนวนชิ้นที่ขาย" value={`${qtySold.toLocaleString("th-TH")} ชิ้น`} />
      </div>

      {/* Daily chart */}
      <div className="card p-5">
        <h2 className="font-semibold">ยอดขายรายวัน</h2>
        {revenue === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--muted)]">
            ยังไม่มียอดขายในช่วงนี้
          </p>
        ) : (
          <div className="mt-4 flex h-52 items-stretch gap-1 overflow-x-auto">
            {series.map((s) => (
              <div
                key={s.d}
                className="flex min-w-[24px] flex-1 flex-col items-center justify-end gap-1"
                title={formatTHB(s.total)}
              >
                <span className="text-[10px] font-medium text-slate-500">
                  {s.total > 0 ? Math.round(s.total) : ""}
                </span>
                <div
                  className="w-full rounded-t bg-[var(--primary)]"
                  style={{
                    height: `${s.total > 0 ? Math.max(4, (s.total / maxDaily) * 170) : 0}px`,
                  }}
                />
                <span className="text-[10px] text-[var(--muted)]">
                  {s.d.slice(8, 10)}/{s.d.slice(5, 7)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top products */}
        <div className="card p-5">
          <h2 className="font-semibold">สินค้าขายดี</h2>
          <div className="mt-3 space-y-2">
            {topRows.length === 0 && (
              <p className="text-sm text-[var(--muted)]">ยังไม่มีข้อมูล</p>
            )}
            {topRows.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="text-[var(--muted)]">{i + 1}.</span>
                  {p.name}
                </span>
                <span className="text-[var(--muted)]">
                  {Number(p.qty).toLocaleString("th-TH")} ชิ้น ·{" "}
                  <span className="font-medium text-foreground">
                    {formatTHB(Number(p.revenue))}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment breakdown */}
        <div className="card p-5">
          <h2 className="font-semibold">แยกตามวิธีชำระ</h2>
          <div className="mt-3 space-y-2">
            {payRows.length === 0 && (
              <p className="text-sm text-[var(--muted)]">ยังไม่มีข้อมูล</p>
            )}
            {payRows.map((p) => (
              <div key={p.payment_method} className="flex items-center justify-between text-sm">
                <span>{p.payment_method === "cash" ? "💵 เงินสด" : "📱 พร้อมเพย์"}</span>
                <span className="text-[var(--muted)]">
                  {Number(p.bills)} บิล ·{" "}
                  <span className="font-medium text-foreground">
                    {formatTHB(Number(p.total))}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* By cashier */}
      <div className="card p-5">
        <h2 className="font-semibold">ยอดขายแยกตามพนักงาน</h2>
        <div className="mt-3 space-y-2">
          {cashierRows.length === 0 && (
            <p className="text-sm text-[var(--muted)]">ยังไม่มีข้อมูล</p>
          )}
          {cashierRows.map((c, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="text-[var(--muted)]">👤</span>
                {c.cashier}
              </span>
              <span className="text-[var(--muted)]">
                {Number(c.bills)} บิล ·{" "}
                <span className="font-medium text-foreground">
                  {formatTHB(Number(c.total))}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-[var(--muted)]">
        * กำไร/ต้นทุนคำนวณจากต้นทุนสินค้า ณ เวลาที่ขายจริง (แม่นยำ ไม่เปลี่ยนตามราคาทุนปัจจุบัน)
      </p>
    </div>
  );
}
