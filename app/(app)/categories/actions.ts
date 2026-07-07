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

export async function saveCategory(formData: FormData): Promise<Result> {
  try {
    const orgId = await requireOrg();
    const id = String(formData.get("id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { ok: false, error: "กรุณากรอกชื่อหมวด" };

    if (id) {
      await query("update categories set name=$1 where id=$2 and org_id=$3", [
        name,
        id,
        orgId,
      ]);
    } else {
      await query("insert into categories (org_id, name) values ($1,$2)", [
        orgId,
        name,
      ]);
    }
    revalidatePath("/categories");
    revalidatePath("/products");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteCategory(id: string): Promise<Result> {
  try {
    const orgId = await requireOrg();
    // สินค้าในหมวดจะถูกตั้ง category_id = null อัตโนมัติ (FK on delete set null)
    await query("delete from categories where id=$1 and org_id=$2", [id, orgId]);
    revalidatePath("/categories");
    revalidatePath("/products");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
