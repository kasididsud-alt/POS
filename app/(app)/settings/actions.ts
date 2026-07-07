"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { inviteUserToOrg } from "@/lib/limits";
import type { OrgContext } from "@/lib/guard";

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
    const result = await inviteUserToOrg(
      ctx as OrgContext,
      String(formData.get("email") ?? ""),
      "cashier",
    );
    if (result.ok) revalidatePath("/settings");
    return result;
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
