"use server";

import { revalidatePath } from "next/cache";
import { query, one } from "@/lib/db";
import { getAppContext } from "@/lib/auth";

type Result = { ok: boolean; error?: string };

async function requireOrg() {
  const ctx = await getAppContext();
  if (!ctx?.org) throw new Error("unauthorized");
  if (ctx.membership?.role !== "owner")
    throw new Error("เฉพาะเจ้าของร้านเท่านั้น");
  return ctx.org.id;
}

export async function saveBranch(formData: FormData): Promise<Result> {
  try {
    const orgId = await requireOrg();
    const id = String(formData.get("id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const type = String(formData.get("type") ?? "shop");
    if (!name) return { ok: false, error: "กรุณากรอกชื่อสาขา/คลัง" };
    if (!["shop", "warehouse"].includes(type))
      return { ok: false, error: "ประเภทไม่ถูกต้อง" };

    const address = String(formData.get("address") ?? "").trim() || null;
    const phone = String(formData.get("phone") ?? "").trim() || null;

    if (id) {
      await query(
        "update branches set name=$1, type=$2, address=$3, phone=$4 where id=$5 and org_id=$6",
        [name, type, address, phone, id, orgId],
      );
    } else {
      await query(
        "insert into branches (org_id, name, type, address, phone) values ($1,$2,$3,$4,$5)",
        [orgId, name, type, address, phone],
      );
    }
    revalidatePath("/branches");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteBranch(id: string): Promise<Result> {
  try {
    const orgId = await requireOrg();

    const b = await one<{ is_default: boolean }>(
      "select is_default from branches where id=$1 and org_id=$2",
      [id, orgId],
    );
    if (!b) return { ok: false, error: "ไม่พบสาขา" };
    if (b.is_default)
      return { ok: false, error: "ลบสาขาหลักไม่ได้ — ตั้งสาขาอื่นเป็นหลักก่อน" };

    // มีประวัติสต็อก → FK restrict จะบล็อกอยู่แล้ว แต่ตอบข้อความให้เข้าใจก่อน
    const hasStock = await one("select 1 from stock_movements where branch_id=$1 limit 1", [id]);
    if (hasStock)
      return { ok: false, error: "สาขานี้มีประวัติสต็อกแล้ว โอน/ล้างสต็อกก่อนจึงจะลบได้" };

    const hasStaff = await one("select 1 from memberships where branch_id=$1 limit 1", [id]);
    if (hasStaff)
      return { ok: false, error: "มีพนักงานสังกัดสาขานี้ — ย้ายพนักงานไปสาขาอื่นก่อน" };

    await query("delete from branches where id=$1 and org_id=$2", [id, orgId]);
    revalidatePath("/branches");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
