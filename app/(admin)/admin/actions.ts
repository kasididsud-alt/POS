"use server";

import { revalidatePath } from "next/cache";
import { query, one } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

type Result = { ok: boolean; error?: string; message?: string };

const COMP_PLANS = ["free", "pro", "premium"] as const;
type CompPlan = (typeof COMP_PLANS)[number];

function revalidateOrg(orgId: string) {
  revalidatePath(`/admin/orgs/${orgId}`);
  revalidatePath("/admin/orgs");
  revalidatePath("/admin");
}

/**
 * comp แพ็กเกจให้ร้าน (override subscription จริง โดยไม่ผ่าน Stripe)
 * plan = 'free' | 'pro' | 'premium' → ตั้ง comp_plan
 * plan = 'clear' → ลบ comp_plan (กลับไปคิดตาม subscription/trial จริง)
 */
export async function setOrgPlan(
  orgId: string,
  plan: CompPlan | "clear",
): Promise<Result> {
  try {
    await requireAdmin();
    if (!orgId) return { ok: false, error: "ไม่พบร้าน" };

    if (plan === "clear") {
      await query(
        "update subscriptions set comp_plan = null, updated_at = now() where org_id = $1",
        [orgId],
      );
      revalidateOrg(orgId);
      return { ok: true, message: "ยกเลิก comp แพ็กเกจแล้ว (กลับไปคิดตามจริง)" };
    }

    if (!COMP_PLANS.includes(plan))
      return { ok: false, error: "แพ็กเกจไม่ถูกต้อง" };

    // upsert เผื่อร้านยังไม่มีแถว subscription
    await query(
      `insert into subscriptions (org_id, status, comp_plan)
         values ($1, 'active', $2)
       on conflict (org_id) do update
         set comp_plan = excluded.comp_plan, updated_at = now()`,
      [orgId, plan],
    );
    revalidateOrg(orgId);
    return { ok: true, message: `ตั้งแพ็กเกจเป็น ${plan.toUpperCase()} แล้ว` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** ยืดวันทดลองใช้ (trial) ให้ร้าน — สถานะกลับเป็น trialing */
export async function extendTrial(
  orgId: string,
  days: number,
): Promise<Result> {
  try {
    await requireAdmin();
    if (!orgId) return { ok: false, error: "ไม่พบร้าน" };
    const d = Number.isFinite(days) && days > 0 ? Math.floor(days) : 14;
    await query(
      `insert into subscriptions (org_id, status, trial_ends_at)
         values ($1, 'trialing', now() + make_interval(days => $2))
       on conflict (org_id) do update
         set status = 'trialing',
             trial_ends_at = now() + make_interval(days => $2),
             updated_at = now()`,
      [orgId, d],
    );
    revalidateOrg(orgId);
    return { ok: true, message: `ยืดทดลองใช้อีก ${d} วันแล้ว` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** เปลี่ยน role ของสมาชิกในร้าน (owner/cashier) */
export async function setMemberRole(
  orgId: string,
  userId: string,
  role: "owner" | "cashier",
): Promise<Result> {
  try {
    await requireAdmin();
    if (role !== "owner" && role !== "cashier")
      return { ok: false, error: "สิทธิ์ไม่ถูกต้อง" };

    // กันไม่ให้ร้านเหลือ 0 เจ้าของ
    if (role === "cashier") {
      const target = await one<{ role: string }>(
        "select role from memberships where org_id = $1 and user_id = $2",
        [orgId, userId],
      );
      if (!target) return { ok: false, error: "ไม่พบสมาชิกในร้านนี้" };
      if (target.role === "owner") {
        const owners = await one<{ n: number }>(
          "select count(*)::int as n from memberships where org_id = $1 and role = 'owner'",
          [orgId],
        );
        if ((owners?.n ?? 0) <= 1)
          return { ok: false, error: "ร้านต้องมีเจ้าของอย่างน้อย 1 คน" };
      }
    }

    await query(
      "update memberships set role = $1 where org_id = $2 and user_id = $3",
      [role, orgId, userId],
    );
    revalidateOrg(orgId);
    return { ok: true, message: "เปลี่ยนสิทธิ์แล้ว" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
