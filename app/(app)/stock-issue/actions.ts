"use server";

import { revalidatePath } from "next/cache";
import { query, one } from "@/lib/db";
import { getAppContext } from "@/lib/auth";

type Result = { ok: boolean; error?: string };

export async function issueStock(formData: FormData): Promise<Result> {
  try {
    const ctx = await getAppContext();
    if (!ctx?.org) throw new Error("unauthorized");

    const productId = String(formData.get("product_id") ?? "");
    const qty = Number(formData.get("qty") ?? 0);
    const reasonLabel = String(formData.get("reason_label") ?? "เบิกใช้");
    const note = String(formData.get("note") ?? "").trim();
    if (!productId || !Number.isInteger(qty) || qty <= 0)
      return { ok: false, error: "ระบุสินค้าและจำนวน (จำนวนเต็ม มากกว่า 0)" };
    if (!ctx.branchId) return { ok: false, error: "ยังไม่ได้กำหนดสาขา" };

    // สินค้าต้องเป็นของร้านนี้ — กันยิงข้าม org
    const product = await one(
      "select id from products where id=$1 and org_id=$2",
      [productId, ctx.org.id],
    );
    if (!product) return { ok: false, error: "ไม่พบสินค้านี้ในร้าน" };

    // กันเบิกจนสต็อกสาขาติดลบ
    const stock = await one<{ qty: number }>(
      `select coalesce(sum(qty_change),0)::int as qty from stock_movements
        where product_id=$1 and branch_id=$2`,
      [productId, ctx.branchId],
    );
    const available = Number(stock?.qty ?? 0);
    if (qty > available)
      return {
        ok: false,
        error: `สต็อกสาขานี้เหลือ ${available} — เบิก ${qty} ไม่ได้`,
      };

    const fullNote = [reasonLabel, note].filter(Boolean).join(" — ");
    await query(
      `insert into stock_movements (org_id, product_id, branch_id, qty_change, reason, note, created_by)
       values ($1,$2,$3,$4,'adjust',$5,$6)`,
      [ctx.org.id, productId, ctx.branchId, -Math.abs(qty), fullNote, ctx.userId],
    );

    revalidatePath("/stock-issue");
    revalidatePath("/stock");
    revalidatePath("/products");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
