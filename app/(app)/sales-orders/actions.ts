"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { assertPlanAllows, assertRoleAtLeast } from "@/lib/limits";

type Result = { ok: boolean; error?: string };
type SOLine = { product_id: string; name: string; unit_price: number; qty: number };

export async function createSalesOrder(input: {
  customer_id: string | null;
  note: string | null;
  items: SOLine[];
}): Promise<Result> {
  try {
    const ctx = await getAppContext();
    if (!ctx?.org) throw new Error("unauthorized");
    // ออเดอร์ขายส่ง = ฟีเจอร์แพ็ก Pro — บังคับที่ action ด้วย (layout gate ทำงานแค่ตอน render)
    assertPlanAllows(ctx.subscription, "/sales-orders");
    // ออเดอร์ขายส่งมูลค่าสูง — ผู้จัดการขึ้นไป
    assertRoleAtLeast(ctx.membership?.role, "manager");
    const items = (input.items ?? []).filter((i) => i.product_id && i.qty > 0);
    if (!items.length) return { ok: false, error: "เพิ่มรายการอย่างน้อย 1" };

    await query("select create_sales_order($1,$2,$3::jsonb,$4,$5)", [
      ctx.org.id,
      input.customer_id || null,
      JSON.stringify(items),
      input.note || null,
      ctx.userId,
    ]);
    revalidatePath("/sales-orders");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function setSOStatus(id: string, status: string): Promise<Result> {
  try {
    // ไม่ gate แพ็กตรงเปลี่ยนสถานะ — ออเดอร์ค้าง (สร้างตอนยังเป็น Pro) ต้องปิด/ยกเลิกได้หลังดาวน์เกรด
    // (สร้างออเดอร์ใหม่ถูก gate อยู่แล้ว)
    const ctx = await getAppContext();
    if (!ctx?.org) throw new Error("unauthorized");
    // เปลี่ยนสถานะออเดอร์ (fulfill/ยกเลิก) — ผู้จัดการขึ้นไป (แพ็กไม่ gate ตรงนี้ แต่บทบาทต้อง gate)
    assertRoleAtLeast(ctx.membership?.role, "manager");
    if (!["open", "confirmed", "fulfilled", "cancelled"].includes(status))
      return { ok: false, error: "สถานะไม่ถูกต้อง" };
    await query("update sales_orders set status=$1 where id=$2 and org_id=$3", [
      status,
      id,
      ctx.org.id,
    ]);
    revalidatePath("/sales-orders");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
