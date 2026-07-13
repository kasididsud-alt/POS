"use server";

import { revalidatePath } from "next/cache";
import { query, one } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { assertPlanAllows } from "@/lib/limits";

type Result = { ok: boolean; error?: string };
type TLine = { product_id: string; name: string; qty: number };

export async function createTransfer(input: {
  from_branch_id: string;
  to_branch_id: string;
  note: string | null;
  items: TLine[];
}): Promise<Result> {
  try {
    const ctx = await getAppContext();
    if (!ctx?.org) throw new Error("unauthorized");
    // โอนย้ายคลัง/สาขา = ฟีเจอร์แพ็ก Premium — บังคับที่ action ด้วย (layout gate ทำงานแค่ตอน render)
    assertPlanAllows(ctx.subscription, "/transfers");
    if (!input.from_branch_id || !input.to_branch_id)
      return { ok: false, error: "เลือกสาขาต้นทางและปลายทาง" };
    if (input.from_branch_id === input.to_branch_id)
      return { ok: false, error: "ต้นทางและปลายทางต้องต่างกัน" };
    const items = (input.items ?? []).filter(
      (i) => i.product_id && Number.isInteger(i.qty) && i.qty > 0,
    );
    if (!items.length) return { ok: false, error: "เพิ่มรายการอย่างน้อย 1" };

    // สาขาต้นทาง/ปลายทางต้องเป็นของร้านนี้ — กันยิงข้าม org
    const branchIds = new Set(ctx.branches.map((b) => b.id));
    if (!branchIds.has(input.from_branch_id) || !branchIds.has(input.to_branch_id))
      return { ok: false, error: "ไม่พบสาขานี้ในร้าน" };

    // สินค้าทุกตัวต้องเป็นของร้านนี้
    const productIds = items.map((i) => i.product_id);
    const owned = await query<{ id: string }>(
      "select id from products where org_id=$1 and id = any($2::uuid[])",
      [ctx.org.id, productIds],
    );
    if (owned.length !== new Set(productIds).size)
      return { ok: false, error: "มีสินค้าที่ไม่พบในร้าน" };

    await query("select create_transfer($1,$2,$3,$4::jsonb,$5,$6)", [
      ctx.org.id,
      input.from_branch_id,
      input.to_branch_id,
      JSON.stringify(items),
      input.note || null,
      ctx.userId,
    ]);
    revalidatePath("/transfers");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function setTransferStatus(
  id: string,
  status: "received" | "cancelled",
): Promise<Result> {
  try {
    // ไม่ gate แพ็กตรงนี้ — ใบโอนค้าง (สร้างตอนยังเป็น Premium) ตัดสต็อกต้นทางไปแล้ว
    // ร้านที่ดาวน์เกรดต้องกดรับ/ยกเลิกเพื่อไม่ให้สต็อกค้างกลางทาง (สร้างใบใหม่ถูก gate อยู่แล้ว)
    const ctx = await getAppContext();
    if (!ctx?.org) throw new Error("unauthorized");
    const t = await one("select id from stock_transfers where id=$1 and org_id=$2", [
      id,
      ctx.org.id,
    ]);
    if (!t) return { ok: false, error: "ไม่พบใบโอน" };

    // RPC ขยับสต็อกจริง: received → เพิ่มปลายทาง, cancelled → คืนต้นทาง
    if (status === "received") {
      await query("select receive_transfer($1,$2)", [id, ctx.userId]);
    } else {
      await query("select cancel_transfer($1,$2)", [id, ctx.userId]);
    }
    revalidatePath("/transfers");
    revalidatePath("/stock");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
