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

export async function saveCustomer(formData: FormData): Promise<Result> {
  try {
    const orgId = await requireOrg();
    const id = String(formData.get("id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { ok: false, error: "กรุณากรอกชื่อลูกค้า" };

    const fields = {
      name,
      phone: String(formData.get("phone") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      address: String(formData.get("address") ?? "").trim() || null,
      note: String(formData.get("note") ?? "").trim() || null,
      tax_id: String(formData.get("tax_id") ?? "").trim() || null,
      branch: String(formData.get("branch") ?? "").trim() || null,
    };

    if (id) {
      await query(
        "update customers set name=$1, phone=$2, email=$3, address=$4, note=$5, tax_id=$6, branch=$7 where id=$8 and org_id=$9",
        [fields.name, fields.phone, fields.email, fields.address, fields.note, fields.tax_id, fields.branch, id, orgId],
      );
    } else {
      await query(
        "insert into customers (org_id, name, phone, email, address, note, tax_id, branch) values ($1,$2,$3,$4,$5,$6,$7,$8)",
        [orgId, fields.name, fields.phone, fields.email, fields.address, fields.note, fields.tax_id, fields.branch],
      );
    }
    revalidatePath("/customers");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteCustomer(id: string): Promise<Result> {
  try {
    const orgId = await requireOrg();
    await query("delete from customers where id=$1 and org_id=$2", [id, orgId]);
    revalidatePath("/customers");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
