"use server";

import { revalidatePath } from "next/cache";
import { query, one } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { productLimitError } from "@/lib/limits";
import { logAudit } from "@/lib/audit";
import { generateInternalEAN13 } from "@/lib/barcode";

type ActionResult = { ok: boolean; error?: string };

async function requireOrg() {
  const ctx = await getAppContext();
  if (!ctx?.org) throw new Error("unauthorized");
  return { ctx, orgId: ctx.org.id, userId: ctx.userId, branchId: ctx.branchId };
}

export async function saveProduct(formData: FormData): Promise<ActionResult> {
  try {
    const { ctx, orgId, userId, branchId } = await requireOrg();
    const id = String(formData.get("id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { ok: false, error: "กรุณากรอกชื่อสินค้า" };

    const fields = {
      name,
      sku: String(formData.get("sku") ?? "").trim() || null,
      barcode: String(formData.get("barcode") ?? "").trim() || null,
      price: Number(formData.get("price") ?? 0),
      cost: Number(formData.get("cost") ?? 0),
      unit: String(formData.get("unit") ?? "ชิ้น").trim() || "ชิ้น",
      low_stock_threshold: Number(formData.get("low_stock_threshold") ?? 5),
      category_id: String(formData.get("category_id") ?? "").trim() || null,
      image_url: String(formData.get("image_url") ?? "").trim() || null,
    };

    // ---- validation ----
    if (!Number.isFinite(fields.price) || fields.price < 0)
      return { ok: false, error: "ราคาขายต้องไม่ติดลบ" };
    if (!Number.isFinite(fields.cost) || fields.cost < 0)
      return { ok: false, error: "ต้นทุนต้องไม่ติดลบ" };
    if (!Number.isFinite(fields.low_stock_threshold) || fields.low_stock_threshold < 0)
      return { ok: false, error: "จุดแจ้งเตือนต้องไม่ติดลบ" };
    // รับเฉพาะ data URL ของรูปภาพ และกันรูปใหญ่เกิน (~1.5MB)
    if (fields.image_url) {
      if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(fields.image_url))
        return { ok: false, error: "ไฟล์รูปไม่ถูกต้อง" };
      if (fields.image_url.length > 1_500_000)
        return { ok: false, error: "รูปใหญ่เกินไป ลองรูปที่เล็กลง" };
    }
    // กันบาร์โค้ดซ้ำในร้านเดียวกัน
    if (fields.barcode) {
      const dup = await one<{ id: string }>(
        "select id from products where org_id=$1 and barcode=$2 and id <> $3",
        [orgId, fields.barcode, id || "00000000-0000-0000-0000-000000000000"],
      );
      if (dup) return { ok: false, error: `บาร์โค้ด ${fields.barcode} ถูกใช้กับสินค้าอื่นแล้ว` };
    }

    if (id) {
      await query(
        `update products set name=$1, sku=$2, barcode=$3, price=$4, cost=$5,
                unit=$6, low_stock_threshold=$7, category_id=$8, image_url=$9
          where id=$10 and org_id=$11`,
        [
          fields.name,
          fields.sku,
          fields.barcode,
          fields.price,
          fields.cost,
          fields.unit,
          fields.low_stock_threshold,
          fields.category_id,
          fields.image_url,
          id,
          orgId,
        ],
      );
    } else {
      // เพิ่มสินค้าใหม่ — เช็คลิมิตตามแพ็กก่อน
      const limitErr = await productLimitError(orgId, ctx.subscription);
      if (limitErr) return { ok: false, error: limitErr };

      const inserted = await one<{ id: string }>(
        `insert into products (org_id, name, sku, barcode, price, cost, unit, low_stock_threshold, category_id, image_url)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
        [
          orgId,
          fields.name,
          fields.sku,
          fields.barcode,
          fields.price,
          fields.cost,
          fields.unit,
          fields.low_stock_threshold,
          fields.category_id,
          fields.image_url,
        ],
      );
      const initialQty = Number(formData.get("initial_qty") ?? 0);
      if (initialQty > 0 && inserted) {
        if (!branchId) return { ok: false, error: "ยังไม่ได้กำหนดสาขา" };
        await query(
          `insert into stock_movements (org_id, product_id, branch_id, qty_change, reason, note)
           values ($1,$2,$3,$4,'purchase','สต็อกตั้งต้น')`,
          [orgId, inserted.id, branchId, initialQty],
        );
      }
    }

    await logAudit(
      orgId,
      userId,
      id ? "product.update" : "product.create",
      `${fields.name} (฿${fields.price})`,
    );
    revalidatePath("/products");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** สร้างบาร์โค้ด EAN-13 ภายในร้านให้สินค้าที่ยังไม่มีบาร์โค้ด (ทำในระบบเอง) */
export async function assignMissingBarcodes(): Promise<
  ActionResult & { count?: number }
> {
  try {
    const { orgId, userId } = await requireOrg();
    const rows = await query<{ id: string }>(
      "select id from products where org_id=$1 and is_active=true and (barcode is null or barcode='') order by created_at",
      [orgId],
    );
    if (!rows.length) return { ok: true, count: 0 };

    // เลขฐานไม่ซ้ำ: นับจำนวนสินค้าทั้งร้าน + ลำดับในรอบนี้
    const base = await one<{ n: number }>(
      "select count(*)::int as n from products where org_id=$1",
      [orgId],
    );
    let seq = (base?.n ?? 0) + 1;
    let count = 0;
    for (const r of rows) {
      // กันชนกับบาร์โค้ดที่มีอยู่
      let code = generateInternalEAN13(seq++);
      let guard = 0;
      while (
        await one("select 1 from products where org_id=$1 and barcode=$2", [
          orgId,
          code,
        ])
      ) {
        code = generateInternalEAN13(seq++);
        if (++guard > 50) break;
      }
      await query("update products set barcode=$1 where id=$2 and org_id=$3", [
        code,
        r.id,
        orgId,
      ]);
      count++;
    }

    await logAudit(orgId, userId, "product.barcode.generate", `${count} รายการ`);
    revalidatePath("/products");
    revalidatePath("/labels");
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function receiveStock(formData: FormData): Promise<ActionResult> {
  try {
    const { orgId, userId, branchId } = await requireOrg();
    const productId = String(formData.get("product_id") ?? "");
    const qty = Number(formData.get("qty") ?? 0);
    const reason = String(formData.get("reason") ?? "purchase");
    const note = String(formData.get("note") ?? "").trim() || null;
    if (!productId || qty === 0)
      return { ok: false, error: "ระบุสินค้าและจำนวน" };
    if (!branchId) return { ok: false, error: "ยังไม่ได้กำหนดสาขา" };

    // "ปรับยอด" ใส่ค่าลบได้ — แต่ต้องกันไม่ให้สต็อกติดลบ (เหมือน reduceStock)
    const delta = reason === "adjust" ? qty : Math.abs(qty);
    if (delta < 0) {
      const cur = await one<{ qty: number }>(
        "select coalesce(qty,0)::int as qty from product_stock where product_id=$1 and branch_id=$2",
        [productId, branchId],
      );
      const available = cur?.qty ?? 0;
      if (Math.abs(delta) > available)
        return { ok: false, error: `ปรับลดได้ไม่เกินคงเหลือ (${available} ชิ้น)` };
    }

    await query(
      `insert into stock_movements (org_id, product_id, branch_id, qty_change, reason, note, created_by)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [orgId, productId, branchId, delta, reason, note, userId],
    );

    await logAudit(orgId, userId, "stock." + reason, `qty ${qty}`);
    revalidatePath("/products");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function reduceStock(formData: FormData): Promise<ActionResult> {
  try {
    const { orgId, userId, branchId } = await requireOrg();
    const productId = String(formData.get("product_id") ?? "");
    const qty = Math.abs(Number(formData.get("qty") ?? 0));
    const note = String(formData.get("note") ?? "").trim() || null;
    if (!productId || !Number.isFinite(qty) || qty <= 0)
      return { ok: false, error: "ระบุสินค้าและจำนวนที่จะลด" };
    if (!branchId) return { ok: false, error: "ยังไม่ได้กำหนดสาขา" };

    // กันลดจนสต็อกติดลบ (คงเหลือของสาขานี้)
    const cur = await one<{ qty: number }>(
      "select coalesce(qty,0)::int as qty from product_stock where product_id=$1 and branch_id=$2",
      [productId, branchId],
    );
    const available = cur?.qty ?? 0;
    if (qty > available)
      return { ok: false, error: `ลดได้ไม่เกินคงเหลือ (${available} ชิ้น)` };

    await query(
      `insert into stock_movements (org_id, product_id, branch_id, qty_change, reason, note, created_by)
       values ($1,$2,$3,$4,'adjust',$5,$6)`,
      [orgId, productId, branchId, -qty, note, userId],
    );

    await logAudit(orgId, userId, "stock.reduce", `qty -${qty}`);
    revalidatePath("/products");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function createCategory(formData: FormData): Promise<ActionResult> {
  try {
    const { orgId } = await requireOrg();
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { ok: false, error: "กรุณากรอกชื่อหมวด" };
    await query("insert into categories (org_id, name) values ($1,$2)", [
      orgId,
      name,
    ]);
    revalidatePath("/products");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  try {
    const { orgId, userId } = await requireOrg();
    await query(
      "update products set is_active = false where id = $1 and org_id = $2",
      [id, orgId],
    );
    await logAudit(orgId, userId, "product.delete", id);
    revalidatePath("/products");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
