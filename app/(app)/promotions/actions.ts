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

export async function savePromotion(formData: FormData): Promise<Result> {
  try {
    const ctx = await requireOrg();
    // โปรโมชั่น/ส่วนลด = ฟีเจอร์แพ็ก Pro — บังคับที่ action ด้วย (layout gate ทำงานแค่ตอน render)
    assertPlanAllows(ctx.subscription, "/promotions");
    const orgId = ctx.org!.id;
    const id = String(formData.get("id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const type = String(formData.get("type") ?? "percent");
    if (!name) return { ok: false, error: "กรุณากรอกชื่อโปรโมชั่น" };
    if (!["percent", "amount"].includes(type))
      return { ok: false, error: "ประเภทไม่ถูกต้อง" };

    const value = Number(formData.get("value") ?? 0);
    const minPurchase = Number(formData.get("min_purchase") ?? 0);
    const startsAt = String(formData.get("starts_at") ?? "").trim() || null;
    const endsAt = String(formData.get("ends_at") ?? "").trim() || null;
    const isActive = formData.get("is_active") === "on";

    if (id) {
      await query(
        `update promotions set name=$1, type=$2, value=$3, min_purchase=$4,
                starts_at=$5, ends_at=$6, is_active=$7 where id=$8 and org_id=$9`,
        [name, type, value, minPurchase, startsAt, endsAt, isActive, id, orgId],
      );
    } else {
      await query(
        `insert into promotions (org_id, name, type, value, min_purchase, starts_at, ends_at, is_active)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [orgId, name, type, value, minPurchase, startsAt, endsAt, isActive],
      );
    }
    revalidatePath("/promotions");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deletePromotion(id: string): Promise<Result> {
  try {
    // ไม่ gate แพ็กตรงลบ — ร้านที่ดาวน์เกรดต้องลบโปรที่ยัง active ได้ (ไม่งั้นส่วนลดค้างที่ POS)
    const orgId = (await requireOrg()).org!.id;
    await query("delete from promotions where id=$1 and org_id=$2", [id, orgId]);
    revalidatePath("/promotions");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
