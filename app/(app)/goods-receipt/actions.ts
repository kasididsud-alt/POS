"use server";

import { revalidatePath } from "next/cache";
import { one } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
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
    (i) => i.product_id && i.qty > 0,
  );
  if (!items.length) return { ok: false, error: "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ" };
  if (!ctx.branchId) return { ok: false, error: "ยังไม่ได้กำหนดสาขา" };

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
    revalidatePath("/goods-receipt");
    revalidatePath("/stock");
    revalidatePath("/products");
    return { ok: true, receipt_id: row?.receive_goods };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
