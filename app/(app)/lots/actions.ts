"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { getAppContext } from "@/lib/auth";

type Result = { ok: boolean; error?: string };

async function requireOrg() {
  const ctx = await getAppContext();
  if (!ctx?.org) throw new Error("unauthorized");
  return ctx.org.id;
}

export async function saveLot(formData: FormData): Promise<Result> {
  try {
    const orgId = await requireOrg();
    const id = String(formData.get("id") ?? "").trim();
    const productId = String(formData.get("product_id") ?? "").trim();
    const lotNo = String(formData.get("lot_no") ?? "").trim() || null;
    const expiry = String(formData.get("expiry_date") ?? "").trim() || null;
    const qty = Number(formData.get("qty") ?? 0);
    if (!productId) return { ok: false, error: "เลือกสินค้า" };

    if (id) {
      await query(
        "update product_lots set product_id=$1, lot_no=$2, expiry_date=$3, qty=$4 where id=$5 and org_id=$6",
        [productId, lotNo, expiry, qty, id, orgId],
      );
    } else {
      await query(
        "insert into product_lots (org_id, product_id, lot_no, expiry_date, qty) values ($1,$2,$3,$4,$5)",
        [orgId, productId, lotNo, expiry, qty],
      );
    }
    revalidatePath("/lots");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteLot(id: string): Promise<Result> {
  try {
    const orgId = await requireOrg();
    await query("delete from product_lots where id=$1 and org_id=$2", [id, orgId]);
    revalidatePath("/lots");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
