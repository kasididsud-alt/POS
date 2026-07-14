"use server";

import { revalidatePath } from "next/cache";
import { one, query } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { ReceiptLine } from "@/lib/types";

export type ReceiveInput = {
  supplier_id: string | null;
  ref_no: string | null;
  note: string | null;
  items: ReceiptLine[];
};

export type ReceiveResult = { ok: boolean; error?: string; receipt_id?: string };

export async function receiveGoods(input: ReceiveInput): Promise<ReceiveResult> {
  const ctx = await getAppContext();
  if (!ctx?.org) return { ok: false, error: "unauthorized" };

  const items = (input.items ?? []).filter(
    (i) => i.product_id && Number.isInteger(i.qty) && i.qty > 0,
  );
  if (!items.length) return { ok: false, error: "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ" };
  if (!ctx.branchId) return { ok: false, error: "ยังไม่ได้กำหนดสาขา" };

  // สินค้าทุกตัว + ซัพพลายเออร์ ต้องเป็นของร้านนี้ — กันยิงข้าม org
  const productIds = items.map((i) => i.product_id);
  const owned = await query<{ id: string }>(
    "select id from products where org_id=$1 and id = any($2::uuid[])",
    [ctx.org.id, productIds],
  );
  if (owned.length !== new Set(productIds).size)
    return { ok: false, error: "มีสินค้าที่ไม่พบในร้าน" };
  if (input.supplier_id) {
    const sup = await one(
      "select id from suppliers where id=$1 and org_id=$2",
      [input.supplier_id, ctx.org.id],
    );
    if (!sup) return { ok: false, error: "ไม่พบซัพพลายเออร์นี้ในร้าน" };
  }

  try {
    const row = await one<{ receive_goods: string }>(
      "select receive_goods($1, $2, $3::jsonb, $4, $5, $6, $7) as receive_goods",
      [
        ctx.org.id,
        input.supplier_id || null,
        JSON.stringify(items),
        input.ref_no || null,
        input.note || null,
        ctx.userId,
        ctx.branchId,
      ],
    );
    await logAudit(
      ctx.org.id,
      ctx.userId,
      "stock.receive",
      `รับเข้า ${items.length} รายการ${input.ref_no ? ` (อ้างอิง ${input.ref_no})` : ""}`,
    );
    revalidatePath("/goods-receipt");
    revalidatePath("/stock");
    revalidatePath("/products");
    return { ok: true, receipt_id: row?.receive_goods };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
