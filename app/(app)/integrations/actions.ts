"use server";

import { revalidatePath } from "next/cache";
import { query, one } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { generateApiKey } from "@/lib/api-keys";
import { assertPlanAllows } from "@/lib/limits";

type Result = { ok: boolean; error?: string };

async function requireOwner() {
  const ctx = await getAppContext();
  if (!ctx?.org) throw new Error("unauthorized");
  if (ctx.membership?.role !== "owner")
    throw new Error("เฉพาะเจ้าของร้านเท่านั้น");
  return ctx;
}

/** สร้าง API key ใหม่ — คืน key เต็มกลับครั้งเดียว (เก็บเฉพาะ hash) */
export async function createApiKey(
  formData: FormData,
): Promise<Result & { key?: string }> {
  try {
    const ctx = await requireOwner();
    // API key / การเชื่อมต่อ = ฟีเจอร์แพ็ก Premium — บังคับที่ action ด้วย (กันแพ็กต่ำ mint key)
    assertPlanAllows(ctx.subscription, "/integrations");
    const name = String(formData.get("name") ?? "").trim() || "API key";

    const count = await one<{ n: number }>(
      "select count(*)::int n from api_keys where org_id=$1 and revoked_at is null",
      [ctx.org!.id],
    );
    if ((count?.n ?? 0) >= 10)
      return { ok: false, error: "มี API key ที่ใช้งานได้ครบ 10 อันแล้ว" };

    const { key, prefix, hash } = generateApiKey();
    await query(
      `insert into api_keys (org_id, name, prefix, key_hash, created_by)
       values ($1,$2,$3,$4,$5)`,
      [ctx.org!.id, name, prefix, hash, ctx.userId],
    );

    revalidatePath("/integrations");
    return { ok: true, key };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** ยกเลิก API key */
export async function revokeApiKey(id: string): Promise<Result> {
  try {
    const ctx = await requireOwner();
    await query(
      "update api_keys set revoked_at=now() where id=$1 and org_id=$2 and revoked_at is null",
      [id, ctx.org!.id],
    );
    revalidatePath("/integrations");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
