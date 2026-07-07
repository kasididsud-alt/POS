"use server";

import { revalidatePath } from "next/cache";
import { query, one } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { getAppContext } from "@/lib/auth";

type Result = { ok: boolean; error?: string; message?: string };

async function requireOwner() {
  const ctx = await getAppContext();
  if (!ctx?.org) throw new Error("unauthorized");
  if (ctx.membership?.role !== "owner")
    throw new Error("เฉพาะเจ้าของร้านเท่านั้น");
  return ctx;
}

export async function updateOrg(formData: FormData): Promise<Result> {
  try {
    const ctx = await requireOwner();
    const name = String(formData.get("name") ?? "").trim();
    const promptpay = String(formData.get("promptpay_id") ?? "").trim() || null;
    const address = String(formData.get("address") ?? "").trim() || null;
    const phone = String(formData.get("phone") ?? "").trim() || null;
    const taxId = String(formData.get("tax_id") ?? "").trim() || null;
    const vatRegistered = formData.get("vat_registered") != null;
    const vatRateRaw = Number(formData.get("vat_rate") ?? 7);
    const vatRate =
      Number.isFinite(vatRateRaw) && vatRateRaw >= 0 && vatRateRaw <= 100
        ? vatRateRaw
        : 7;
    if (!name) return { ok: false, error: "กรุณากรอกชื่อร้าน" };

    await query(
      "update organizations set name=$1, promptpay_id=$2, address=$3, phone=$4, tax_id=$5, vat_registered=$6, vat_rate=$7 where id=$8",
      [name, promptpay, address, phone, taxId, vatRegistered, vatRate, ctx.org!.id],
    );
    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return { ok: true, message: "บันทึกแล้ว" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function inviteMember(formData: FormData): Promise<Result> {
  try {
    const ctx = await requireOwner();
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    if (!email) return { ok: false, error: "กรุณากรอกอีเมล" };

    // หา user เดิม หรือสร้างใหม่พร้อมรหัสผ่านชั่วคราว
    let user = await one<{ id: string }>(
      "select id from users where email = $1",
      [email],
    );
    let tempPassword: string | null = null;
    if (!user) {
      tempPassword = Math.random().toString(36).slice(-8);
      const hash = await hashPassword(tempPassword);
      user = await one<{ id: string }>(
        "insert into users (email, password_hash) values ($1, $2) returning id",
        [email, hash],
      );
    }

    // กันเพิ่มซ้ำ
    const exists = await one(
      "select id from memberships where org_id = $1 and user_id = $2",
      [ctx.org!.id, user!.id],
    );
    if (exists) return { ok: false, error: "พนักงานคนนี้อยู่ในร้านแล้ว" };

    await query(
      "insert into memberships (org_id, user_id, role) values ($1, $2, 'cashier')",
      [ctx.org!.id, user!.id],
    );

    revalidatePath("/settings");
    return {
      ok: true,
      message: tempPassword
        ? `เพิ่ม ${email} แล้ว — รหัสผ่านชั่วคราว: ${tempPassword} (ให้พนักงานเปลี่ยนภายหลัง)`
        : `เพิ่ม ${email} เข้าร้านแล้ว`,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function removeMember(userId: string): Promise<Result> {
  try {
    const ctx = await requireOwner();
    if (userId === ctx.userId) return { ok: false, error: "ลบตัวเองไม่ได้" };
    await query(
      "delete from memberships where org_id = $1 and user_id = $2",
      [ctx.org!.id, userId],
    );
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
