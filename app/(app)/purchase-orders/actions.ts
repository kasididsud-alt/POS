"use server";

import { revalidatePath } from "next/cache";
import { query, one } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { assertPlanAllows } from "@/lib/limits";

type Result = { ok: boolean; error?: string };

type POLine = { product_id: string; qty: number; unit_cost: number };

export async function createPO(input: {
  supplier_id: string | null;
  note: string | null;
  items: POLine[];
}): Promise<Result> {
  try {
    const ctx = await getAppContext();
    if (!ctx?.org) throw new Error("unauthorized");
    if (ctx.membership?.role !== "owner")
      throw new Error("เฉพาะเจ้าของร้านเท่านั้น");
    // ใบสั่งซื้อ (PO) = ฟีเจอร์แพ็ก Premium — บังคับที่ action ด้วย (layout gate ทำงานแค่ตอน render)
    assertPlanAllows(ctx.subscription, "/purchase-orders");
    const items = (input.items ?? []).filter((i) => i.product_id && i.qty > 0);
    if (!items.length) return { ok: false, error: "เพิ่มรายการอย่างน้อย 1" };

    await query("select create_po($1,$2,$3::jsonb,$4,$5)", [
      ctx.org.id,
      input.supplier_id || null,
      JSON.stringify(items),
      input.note || null,
      ctx.userId,
    ]);
    revalidatePath("/purchase-orders");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function receivePO(poId: string): Promise<Result> {
  try {
    // ไม่ gate แพ็กตรงรับของ/ยกเลิก — PO ค้าง (สร้างตอนยังเป็น Premium) ต้องปิดงานได้หลังดาวน์เกรด
    // ไม่งั้นของที่มาส่งจริงรับเข้าสต็อกไม่ได้ (สร้าง PO ใหม่ถูก gate อยู่แล้ว)
    const ctx = await getAppContext();
    if (!ctx?.org) throw new Error("unauthorized");
    if (ctx.membership?.role !== "owner")
      throw new Error("เฉพาะเจ้าของร้านเท่านั้น");
    // ตรวจว่า PO อยู่ใน org นี้
    const po = await one("select id from purchase_orders where id=$1 and org_id=$2", [
      poId,
      ctx.org.id,
    ]);
    if (!po) return { ok: false, error: "ไม่พบใบสั่งซื้อ" };
    if (!ctx.branchId) return { ok: false, error: "ยังไม่ได้กำหนดสาขา" };

    await query("select receive_po($1,$2,$3)", [poId, ctx.userId, ctx.branchId]);
    revalidatePath("/purchase-orders");
    revalidatePath("/stock");
    revalidatePath("/goods-receipt");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function cancelPO(poId: string): Promise<Result> {
  try {
    const ctx = await getAppContext();
    if (!ctx?.org) throw new Error("unauthorized");
    if (ctx.membership?.role !== "owner")
      throw new Error("เฉพาะเจ้าของร้านเท่านั้น");
    await query(
      "update purchase_orders set status='cancelled' where id=$1 and org_id=$2 and status='ordered'",
      [poId, ctx.org.id],
    );
    revalidatePath("/purchase-orders");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
