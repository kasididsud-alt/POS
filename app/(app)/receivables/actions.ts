"use server";

import { revalidatePath } from "next/cache";
import { query, one } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { assertPlanAllows } from "@/lib/limits";

type Result = { ok: boolean; error?: string };

async function requireOrg() {
  const ctx = await getAppContext();
  if (!ctx?.org) throw new Error("unauthorized");
  if (ctx.membership?.role !== "owner")
    throw new Error("เฉพาะเจ้าของร้านเท่านั้น");
  return ctx;
}

export async function addDebt(formData: FormData): Promise<Result> {
  try {
    const ctx = await requireOrg();
    // ลูกหนี้/ขายเชื่อ = ฟีเจอร์แพ็ก Premium — บังคับที่ action ด้วย (layout gate ทำงานแค่ตอน render)
    assertPlanAllows(ctx.subscription, "/receivables");
    const customerId = String(formData.get("customer_id") ?? "").trim() || null;
    const amount = Number(formData.get("amount") ?? 0);
    const dueDate = String(formData.get("due_date") ?? "").trim() || null;
    const note = String(formData.get("note") ?? "").trim() || null;
    if (amount <= 0) return { ok: false, error: "ระบุยอดหนี้มากกว่า 0" };

    // ผูกหนี้กับลูกค้าได้เฉพาะลูกค้าของร้านตัวเองเท่านั้น — กันยัด customer_id ข้ามร้าน
    if (customerId) {
      const owned = await one<{ id: string }>(
        "select id from customers where id=$1 and org_id=$2",
        [customerId, ctx.org!.id],
      );
      if (!owned) return { ok: false, error: "ไม่พบลูกค้าในร้านนี้" };
    }

    await query(
      `insert into debts (org_id, customer_id, amount, due_date, note, created_by)
       values ($1,$2,$3,$4,$5,$6)`,
      [ctx.org!.id, customerId, amount, dueDate, note, ctx.userId],
    );
    await logAudit(ctx.org!.id, ctx.userId, "debt.create", `ยอด ${amount}`);
    revalidatePath("/receivables");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function recordPayment(
  debtId: string,
  amount: number,
): Promise<Result> {
  try {
    // ไม่ gate แพ็กตรงรับชำระ — หนี้เดิม (สร้างตอนยังเป็น Premium) เป็นเงินจริงที่ลูกค้าทยอยจ่าย
    // ร้านที่ดาวน์เกรดต้องบันทึกรับชำระ/ปิดหนี้ได้ (ตั้งหนี้ใหม่ถูก gate อยู่แล้ว)
    const ctx = await requireOrg();
    if (amount <= 0) return { ok: false, error: "ยอดชำระต้องมากกว่า 0" };

    const debt = await one<{ amount: number; paid: number }>(
      "select amount, paid from debts where id=$1 and org_id=$2",
      [debtId, ctx.org!.id],
    );
    if (!debt) return { ok: false, error: "ไม่พบรายการ" };

    const newPaid = Number(debt.paid) + amount;
    const status = newPaid >= Number(debt.amount) ? "paid" : "open";
    await query("update debts set paid=$1, status=$2 where id=$3 and org_id=$4", [
      newPaid,
      status,
      debtId,
      ctx.org!.id,
    ]);
    await logAudit(ctx.org!.id, ctx.userId, "debt.payment", `รับชำระ ${amount} (${status})`);
    revalidatePath("/receivables");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteDebt(id: string): Promise<Result> {
  try {
    // ไม่ gate แพ็กตรงลบ — ร้านที่ดาวน์เกรดยังเก็บกวาดข้อมูลเดิมได้
    const ctx = await requireOrg();
    await query("delete from debts where id=$1 and org_id=$2", [id, ctx.org!.id]);
    await logAudit(ctx.org!.id, ctx.userId, "debt.delete", id);
    revalidatePath("/receivables");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
