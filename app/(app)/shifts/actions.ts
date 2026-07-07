"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query, one } from "@/lib/db";
import { getAppContext } from "@/lib/auth";

function fail(msg: string): never {
  redirect("/shifts?error=" + encodeURIComponent(msg));
}

export async function openShift(formData: FormData): Promise<void> {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/login");
  if (!ctx.branchId) fail("ยังไม่ได้กำหนดสาขา");
  const opening = Number(formData.get("opening_cash") ?? 0);
  if (!Number.isFinite(opening) || opening < 0) fail("จำนวนเงินตั้งต้นไม่ถูกต้อง");

  const existing = await one(
    "select id from cash_shifts where org_id=$1 and branch_id=$2 and status='open'",
    [ctx.org.id, ctx.branchId],
  );
  if (existing) fail("สาขานี้มีกะที่เปิดอยู่แล้ว");

  await query(
    "insert into cash_shifts (org_id, branch_id, opened_by, opening_cash) values ($1,$2,$3,$4)",
    [ctx.org.id, ctx.branchId, ctx.userId, opening],
  );
  revalidatePath("/shifts");
}

export async function closeShift(formData: FormData): Promise<void> {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/login");
  const shiftId = String(formData.get("shift_id") ?? "");
  const closing = Number(formData.get("closing_cash") ?? 0);
  if (!Number.isFinite(closing) || closing < 0) fail("จำนวนเงินนับปิดกะไม่ถูกต้อง");

  const shift = await one<{
    opening_cash: number;
    opened_at: string;
    branch_id: string | null;
  }>(
    "select opening_cash, opened_at, branch_id from cash_shifts where id=$1 and org_id=$2 and status='open'",
    [shiftId, ctx.org.id],
  );
  if (!shift) fail("ไม่พบกะที่เปิดอยู่");

  // ยอดขายเงินสดเฉพาะสาขาของกะนี้ (กะเก่าก่อน migration อาจไม่มีสาขา → คิดทั้ง org ตามเดิม)
  const cashSales = await one<{ total: number }>(
    `select coalesce(sum(total),0) as total from sales
      where org_id=$1 and payment_method='cash' and created_at >= $2
        and ($3::uuid is null or branch_id = $3)`,
    [ctx.org.id, shift!.opened_at, shift!.branch_id],
  );
  // เงินคืนที่จ่ายออกจากลิ้นชักในกะนี้ (คืนของบิลเงินสด) — ลดเงินสดที่ควรมี
  const cashRefunds = await one<{ total: number }>(
    `select coalesce(sum(r.total_refund),0) as total
       from sale_returns r join sales s on s.id = r.sale_id
      where r.org_id=$1 and r.created_at >= $2 and s.payment_method='cash'
        and ($3::uuid is null or s.branch_id = $3)`,
    [ctx.org.id, shift!.opened_at, shift!.branch_id],
  );
  const expected =
    Number(shift!.opening_cash) +
    Number(cashSales?.total ?? 0) -
    Number(cashRefunds?.total ?? 0);

  await query(
    `update cash_shifts set closing_cash=$1, expected_cash=$2, status='closed', closed_at=now()
      where id=$3 and org_id=$4`,
    [closing, expected, shiftId, ctx.org.id],
  );
  revalidatePath("/shifts");
}
