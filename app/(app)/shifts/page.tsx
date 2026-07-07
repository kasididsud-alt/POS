import { redirect } from "next/navigation";
import { query, one } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { formatTHB, formatDateTime } from "@/lib/format";
import { openShift, closeShift } from "./actions";

type Shift = {
  id: string;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
};

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/onboarding");
  const orgId = ctx.org.id;
  const sp = await searchParams;

  // กะของสาขาปัจจุบันเท่านั้น (กะเก่าก่อนแยกสาขา branch_id เป็น null → ยังมองเห็น)
  const current = await one<Shift>(
    `select * from cash_shifts
      where org_id=$1 and status='open' and (branch_id = $2 or branch_id is null)
      order by opened_at desc limit 1`,
    [orgId, ctx.branchId],
  );

  let liveSales = 0;
  if (current) {
    const r = await one<{ total: number }>(
      `select coalesce(sum(total),0) as total from sales
        where org_id=$1 and payment_method='cash' and created_at >= $2
          and ($3::uuid is null or branch_id = $3)`,
      [orgId, current.opened_at, ctx.branchId],
    );
    liveSales = Number(r?.total ?? 0);
  }

  const history = await query<Shift>(
    `select * from cash_shifts
      where org_id=$1 and status='closed' and (branch_id = $2 or branch_id is null)
      order by closed_at desc limit 20`,
    [orgId, ctx.branchId],
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">เปิด-ปิดกะ / นับเงิน</h1>

      {sp.error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {sp.error}
        </div>
      )}

      {current ? (
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">กะที่เปิดอยู่</h2>
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
              เปิดอยู่
            </span>
          </div>
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">เปิดเมื่อ</span>
              <span>{formatDateTime(current.opened_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">เงินเปิดลิ้นชัก</span>
              <span>{formatTHB(Number(current.opening_cash))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">ขายเงินสดในกะ</span>
              <span>{formatTHB(liveSales)}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--border)] pt-1 font-semibold">
              <span>เงินที่ควรมีในลิ้นชัก</span>
              <span>{formatTHB(Number(current.opening_cash) + liveSales)}</span>
            </div>
          </div>
          <form action={closeShift} className="mt-4 flex items-end gap-2">
            <input type="hidden" name="shift_id" value={current.id} />
            <div className="flex-1">
              <label className="label">นับเงินจริงปลายกะ</label>
              <input
                name="closing_cash"
                type="number"
                step="0.01"
                required
                className="input"
              />
            </div>
            <button className="btn-primary">ปิดกะ</button>
          </form>
        </div>
      ) : (
        <div className="card p-6">
          <h2 className="font-semibold">ยังไม่มีกะเปิดอยู่</h2>
          <form action={openShift} className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <label className="label">เงินเปิดลิ้นชัก</label>
              <input
                name="opening_cash"
                type="number"
                step="0.01"
                defaultValue={0}
                className="input"
              />
            </div>
            <button className="btn-primary">เปิดกะ</button>
          </form>
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-semibold">ประวัติกะ</h2>
        <div className="mt-3 space-y-2 text-sm">
          {history.length === 0 && (
            <p className="text-[var(--muted)]">ยังไม่มีประวัติ</p>
          )}
          {history.map((s) => {
            const diff =
              Number(s.closing_cash ?? 0) - Number(s.expected_cash ?? 0);
            return (
              <div key={s.id} className="flex items-center justify-between">
                <div>
                  <div>{s.closed_at ? formatDateTime(s.closed_at) : "—"}</div>
                  <div className="text-xs text-[var(--muted)]">
                    ควรมี {formatTHB(Number(s.expected_cash ?? 0))} · นับได้{" "}
                    {formatTHB(Number(s.closing_cash ?? 0))}
                  </div>
                </div>
                <span
                  className={`font-medium ${
                    diff === 0
                      ? "text-[var(--muted)]"
                      : diff > 0
                        ? "text-green-600"
                        : "text-red-600"
                  }`}
                >
                  {diff > 0 ? "เกิน +" : diff < 0 ? "ขาด " : ""}
                  {formatTHB(diff)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
