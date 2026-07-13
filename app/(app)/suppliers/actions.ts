"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { assertPlanAllows, assertRoleAtLeast } from "@/lib/limits";

type Result = { ok: boolean; error?: string };

async function requireOrg() {
  const ctx = await getAppContext();
  if (!ctx?.org) throw new Error("unauthorized");
  assertRoleAtLeast(ctx.membership?.role, "manager"); // ผู้จัดการขึ้นไป — จัดการได้ แต่ไม่ใช่เรื่องเงิน/ทีมงาน
  return ctx;
}

export async function saveSupplier(formData: FormData): Promise<Result> {
  try {
    const ctx = await requireOrg();
    // ซัพพลายเออร์ = ฟีเจอร์แพ็ก Premium — บังคับที่ action ด้วย (layout gate ทำงานแค่ตอน render)
    assertPlanAllows(ctx.subscription, "/suppliers");
    const orgId = ctx.org!.id;
    const id = String(formData.get("id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { ok: false, error: "กรุณากรอกชื่อซัพพลายเออร์" };

    const f = {
      name,
      phone: String(formData.get("phone") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      address: String(formData.get("address") ?? "").trim() || null,
      note: String(formData.get("note") ?? "").trim() || null,
    };

    if (id) {
      await query(
        "update suppliers set name=$1, phone=$2, email=$3, address=$4, note=$5 where id=$6 and org_id=$7",
        [f.name, f.phone, f.email, f.address, f.note, id, orgId],
      );
    } else {
      await query(
        "insert into suppliers (org_id, name, phone, email, address, note) values ($1,$2,$3,$4,$5,$6)",
        [orgId, f.name, f.phone, f.email, f.address, f.note],
      );
    }
    revalidatePath("/suppliers");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteSupplier(id: string): Promise<Result> {
  try {
    // ไม่ gate แพ็กตรงลบ — ร้านที่ดาวน์เกรดยังเก็บกวาดข้อมูลเดิมได้
    const orgId = (await requireOrg()).org!.id;
    await query("delete from suppliers where id=$1 and org_id=$2", [id, orgId]);
    revalidatePath("/suppliers");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
