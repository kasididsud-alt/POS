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
  const opening = Number(formData.get("opening_cash") ?? 0);

  const existing = await one(
    "select id from cash_shifts where org_id=$1 and status='open'",
    [ctx.org.id],
  );
  if (existing) fail("มีกะที่เปิดอยู่แล้ว");

  await query(
    "insert into cash_shifts (org_id, opened_by, opening_cash) values ($1,$2,$3)",
    [ctx.org.id, ctx.userId, opening],
  );
  revalidatePath("/shifts");
}

export async function closeShift(formData: FormData): Promise<void> {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/login");
  const shiftId = String(formData.get("shift_id") ?? "");
  const closing = Number(formData.get("closing_cash") ?? 0);

  const shift = await one<{ opening_cash: number; opened_at: string }>(
    "select opening_cash, opened_at from cash_shifts where id=$1 and org_id=$2 and status='open'",
    [shiftId, ctx.org.id],
  );
  if (!shift) fail("ไม่พบกะที่เปิดอยู่");

  const cashSales = await one<{ total: number }>(
    `select coalesce(sum(total),0) as total from sales
      where org_id=$1 and payment_method='cash' and created_at >= $2`,
    [ctx.org.id, shift!.opened_at],
  );
  const expected = Number(shift!.opening_cash) + Number(cashSales?.total ?? 0);

  await query(
    `update cash_shifts set closing_cash=$1, expected_cash=$2, status='closed', closed_at=now()
      where id=$3 and org_id=$4`,
    [closing, expected, shiftId, ctx.org.id],
  );
  revalidatePath("/shifts");
}
