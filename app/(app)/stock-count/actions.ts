"use server";

import { revalidatePath } from "next/cache";
import { query, one } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { assertPlanAllows, assertRoleAtLeast } from "@/lib/limits";

type CountLine = { product_id: string; counted: number };
type Result = { ok: boolean; error?: string; adjusted?: number };

export async function applyCount(lines: CountLine[]): Promise<Result> {
  try {
    const ctx = await getAppContext();
    if (!ctx?.org) throw new Error("unauthorized");
    // ตรวจนับสต็อก = ฟีเจอร์แพ็ก Premium — บังคับที่ action ด้วย (layout gate ทำงานแค่ตอน render)
    assertPlanAllows(ctx.subscription, "/stock-count");
    // ยืนยันผลนับ = ระบบปรับยอดจริง — ผู้จัดการขึ้นไป (แคชเชียร์เป็นคนนับ แต่คนกดยืนยันต้องระดับบริหาร)
    assertRoleAtLeast(ctx.membership?.role, "manager");
    const orgId = ctx.org.id;
    const branchId = ctx.branchId;
    if (!branchId) return { ok: false, error: "ยังไม่ได้กำหนดสาขา" };

    let adjusted = 0;
    for (const l of lines) {
      if (!l.product_id || l.counted == null || Number.isNaN(l.counted)) continue;
      const row = await one<{ qty: number }>(
        "select coalesce(qty,0)::int as qty from product_stock where product_id=$1 and org_id=$2 and branch_id=$3",
        [l.product_id, orgId, branchId],
      );
      const current = row?.qty ?? 0;
      const diff = Math.round(l.counted) - current;
      if (diff === 0) continue;
      await query(
        `insert into stock_movements (org_id, product_id, branch_id, qty_change, reason, note, created_by)
         values ($1,$2,$3,$4,'adjust','ตรวจนับสต็อก',$5)`,
        [orgId, l.product_id, branchId, diff, ctx.userId],
      );
      adjusted++;
    }

    revalidatePath("/stock-count");
    revalidatePath("/stock");
    revalidatePath("/products");
    return { ok: true, adjusted };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
