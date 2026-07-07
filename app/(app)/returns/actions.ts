"use server";

import { revalidatePath } from "next/cache";
import { one } from "@/lib/db";
import { getAppContext } from "@/lib/auth";

// ส่งแค่ product_id + qty — ราคาคืนคิดจากราคาขายจริง (sale_items) ฝั่ง DB
type ReturnLine = {
  product_id: string;
  qty: number;
};

export type ProcessReturnInput = {
  sale_id: string;
  reason: string | null;
  items: ReturnLine[];
};

export type ProcessReturnResult = {
  ok: boolean;
  error?: string;
  return_id?: string;
};

export async function processReturn(
  input: ProcessReturnInput,
): Promise<ProcessReturnResult> {
  const ctx = await getAppContext();
  if (!ctx?.org) return { ok: false, error: "unauthorized" };

  const items = (input.items ?? [])
    .filter((i) => i.product_id && i.qty > 0)
    .map(({ product_id, qty }) => ({ product_id, qty }));
  if (!items.length) return { ok: false, error: "เลือกรายการที่ต้องการคืนอย่างน้อย 1" };
  if (!ctx.branchId) return { ok: false, error: "ยังไม่ได้กำหนดสาขา" };

  try {
    const row = await one<{ process_return: string }>(
      "select process_return($1, $2, $3::jsonb, $4, $5, $6) as process_return",
      [
        ctx.org.id,
        input.sale_id,
        JSON.stringify(items),
        input.reason || null,
        ctx.userId,
        ctx.branchId,
      ],
    );
    revalidatePath("/returns");
    revalidatePath("/stock");
    revalidatePath("/products");
    return { ok: true, return_id: row?.process_return };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
