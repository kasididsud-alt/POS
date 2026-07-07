import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { planForOrg, PLANS } from "@/lib/plans";
import { planAllowsPath, minPlanForPath } from "@/components/nav";
import type { OrgContext } from "@/lib/guard";
import type { Subscription } from "@/lib/types";

/**
 * guard หน้า/ฟีเจอร์ที่ต้องแพ็กขั้นต่ำ — แพ็กต่ำกว่าเด้งไป /pricing
 * ใช้ใน (app)/layout เพื่อครอบทุกหน้าในจุดเดียว
 */
export function assertPlanForPath(sub: Subscription | null, path: string): void {
  const plan = planForOrg(sub);
  if (!planAllowsPath(plan, path)) {
    const need = minPlanForPath(path);
    redirect(`/billing?upgrade=${encodeURIComponent(need)}`);
  }
}

/** ใช้ในหน้า/action ที่มี ctx อยู่แล้ว */
export function requirePlanForPath(ctx: OrgContext, path: string): void {
  assertPlanForPath(ctx.subscription, path);
}

/**
 * เช็คก่อนเพิ่มสินค้าใหม่ — คืนข้อความ error ถ้าถึงลิมิตแพ็ก (else null)
 * (Infinity = ไม่จำกัด → ไม่ต้องเช็ค)
 */
export async function productLimitError(
  orgId: string,
  sub: Subscription | null,
): Promise<string | null> {
  const plan = planForOrg(sub);
  const max = PLANS[plan].limits.products;
  if (!Number.isFinite(max)) return null;

  const rows = await query<{ n: number }>(
    "select count(*)::int as n from products where org_id = $1",
    [orgId],
  );
  const n = Number(rows[0]?.n ?? 0);
  if (n >= max) {
    return `ถึงลิมิตแพ็ก “${PLANS[plan].name}” (${max.toLocaleString("th-TH")} รายการ) แล้ว — อัปเกรดแพ็กเพื่อเพิ่มสินค้าได้อีก`;
  }
  return null;
}
