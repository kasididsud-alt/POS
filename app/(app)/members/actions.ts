"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { assertPlanAllows, assertRoleAtLeast } from "@/lib/limits";

type Result = { ok: boolean; error?: string };

export async function adjustPoints(
  customerId: string,
  delta: number,
): Promise<Result> {
  try {
    const ctx = await getAppContext();
    if (!ctx?.org) throw new Error("unauthorized");
    // สมาชิก/แต้มสะสม = ฟีเจอร์แพ็ก Pro — บังคับที่ action ด้วย (layout gate ทำงานแค่ตอน render)
    assertPlanAllows(ctx.subscription, "/members");
    // ปรับแต้มเอง (ไม่ผ่านบิลขาย) — ผู้จัดการขึ้นไป กันเติมแต้มให้พวกพ้อง
    assertRoleAtLeast(ctx.membership?.role, "manager");
    if (!Number.isFinite(delta) || delta === 0)
      return { ok: false, error: "ระบุจำนวนแต้ม" };

    await query(
      "update customers set points = greatest(points + $1, 0) where id=$2 and org_id=$3",
      [Math.round(delta), customerId, ctx.org.id],
    );
    revalidatePath("/members");
    revalidatePath("/customers");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
