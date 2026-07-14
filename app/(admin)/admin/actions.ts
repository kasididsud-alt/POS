"use server";

import { revalidatePath } from "next/cache";
import { query, one } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { derivePlan } from "@/lib/admin-queries";
import type { Subscription } from "@/lib/types";

type Result = { ok: boolean; error?: string; message?: string };

const COMP_PLANS = ["free", "pro", "premium"] as const;
type CompPlan = (typeof COMP_PLANS)[number];

function revalidateOrg(orgId: string) {
  revalidatePath(`/admin/orgs/${orgId}`);
  revalidatePath("/admin/orgs");
  revalidatePath("/admin");
}

/** ระดับที่มีผลจริงของร้านหลังแก้ subscription (อ่านซ้ำจาก DB) */
async function effectivePlan(orgId: string) {
  const after = await one<
    Pick<Subscription, "status" | "price_id" | "trial_ends_at" | "comp_plan">
  >(
    "select status, price_id, trial_ends_at, comp_plan from subscriptions where org_id = $1",
    [orgId],
  );
  return derivePlan(after);
}

/**
 * ตั้งระดับแพ็กเกจให้ร้าน (โดยไม่ผ่าน Stripe)
 * plan = 'pro' | 'premium' → ตั้ง comp_plan (comp เป็น "พื้น" — ยกระดับได้อย่างเดียว)
 * plan = 'free'            → ปรับร้านเป็นฟรีจริง: ล้าง comp + ตัด trial
 *                            (ห้ามใช้กับร้านที่จ่ายเงินจริงผ่าน Stripe)
 * plan = 'clear'           → ลบ comp_plan (กลับไปคิดตาม subscription/trial จริง)
 */
export async function setOrgPlan(
  orgId: string,
  plan: CompPlan | "clear",
): Promise<Result> {
  try {
    const admin = await requireAdmin();
    if (!orgId) return { ok: false, error: "ไม่พบร้าน" };

    if (plan === "clear") {
      await query(
        "update subscriptions set comp_plan = null, updated_at = now() where org_id = $1",
        [orgId],
      );
      await logAudit(orgId, admin.id, "admin.comp_plan", "clear");
      revalidateOrg(orgId);
      const eff = await effectivePlan(orgId);
      return {
        ok: true,
        message: `ยกเลิก comp แล้ว — ตอนนี้ร้านเป็น ${eff.toUpperCase()} ตามจริง`,
      };
    }

    if (!COMP_PLANS.includes(plan))
      return { ok: false, error: "แพ็กเกจไม่ถูกต้อง" };

    if (plan === "free") {
      // comp_plan เป็น "พื้น" กดลงไม่ได้ — จะให้ร้านเป็นฟรีจริงต้องตัด trial/comp ทิ้ง
      const cur = await one<{
        status: string;
        stripe_subscription_id: string | null;
      }>(
        "select status, stripe_subscription_id from subscriptions where org_id = $1",
        [orgId],
      );
      if (cur?.stripe_subscription_id) {
        return {
          ok: false,
          error:
            "ร้านนี้จ่ายเงินจริงผ่าน Stripe — ปรับเป็นฟรีจากตรงนี้ไม่ได้ ต้องยกเลิก subscription ใน Stripe ก่อน",
        };
      }
      await query(
        `insert into subscriptions (org_id, status, comp_plan, trial_ends_at)
           values ($1, 'canceled', null, null)
         on conflict (org_id) do update
           set status = 'canceled', comp_plan = null, trial_ends_at = null,
               updated_at = now()`,
        [orgId],
      );
      await logAudit(orgId, admin.id, "admin.comp_plan", "force_free");
      revalidateOrg(orgId);
      return {
        ok: true,
        message: "ปรับร้านเป็น FREE แล้ว (ตัด trial/comp ทิ้ง)",
      };
    }

    // pro/premium → comp (upsert เผื่อร้านยังไม่มีแถว subscription)
    await query(
      `insert into subscriptions (org_id, status, comp_plan)
         values ($1, 'active', $2)
       on conflict (org_id) do update
         set comp_plan = excluded.comp_plan, updated_at = now()`,
      [orgId, plan],
    );
    await logAudit(orgId, admin.id, "admin.comp_plan", plan);
    revalidateOrg(orgId);
    const eff = await effectivePlan(orgId);
    return {
      ok: true,
      message:
        eff === plan
          ? `ตั้งแพ็กเกจเป็น ${plan.toUpperCase()} แล้ว`
          : `ตั้ง comp = ${plan.toUpperCase()} แล้ว — แต่ร้านมีสิทธิ์ ${eff.toUpperCase()} จาก subscription จริงซึ่งสูงกว่า`,
    };
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
    const admin = await requireAdmin();
    if (!orgId) return { ok: false, error: "ไม่พบร้าน" };
    const d = Number.isFinite(days) && days > 0 ? Math.floor(days) : 14;

    // กันเขียนทับ subscription ที่จ่ายเงินจริงบน Stripe: ถ้าตั้ง status='trialing' ทับ
    // ร้านที่ status='active' + มี stripe_subscription_id จะเพี้ยนจาก Stripe แล้วพอ
    // trial_ends_at ผ่านไป (Stripe ไม่ยิง event เพราะยังคิดว่า active) ร้านจะโดน
    // ดาวน์เกรดเป็น free เงียบๆ ทั้งที่ยังถูกเรียกเก็บเงิน. อยากแถมสิทธิ์ให้ใช้ comp แทน.
    const cur = await one<{
      status: string;
      stripe_subscription_id: string | null;
      price_id: string | null;
    }>(
      "select status, stripe_subscription_id, price_id from subscriptions where org_id = $1",
      [orgId],
    );
    if (cur && (cur.stripe_subscription_id || cur.status === "active")) {
      return {
        ok: false,
        error:
          "ร้านนี้มี subscription จ่ายเงินจริงอยู่ — ห้ามยืด trial ทับ (จะเพี้ยนจาก Stripe) ถ้าต้องการแถมสิทธิ์ให้ใช้ comp แพ็กเกจแทน",
      };
    }

    await query(
      `insert into subscriptions (org_id, status, trial_ends_at)
         values ($1, 'trialing', now() + make_interval(days => $2))
       on conflict (org_id) do update
         set status = 'trialing',
             trial_ends_at = now() + make_interval(days => $2),
             updated_at = now()`,
      [orgId, d],
    );
    await logAudit(orgId, admin.id, "admin.extend_trial", `${d} days`);
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
    const admin = await requireAdmin();
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
    await logAudit(orgId, admin.id, "admin.set_role", `${userId} → ${role}`);
    revalidateOrg(orgId);
    return { ok: true, message: "เปลี่ยนสิทธิ์แล้ว" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** ปิดเรื่องข้อความติดต่อทีมงาน */
export async function resolveContactMessage(id: string): Promise<Result> {
  try {
    const admin = await requireAdmin();
    const row = await one<{ org_id: string }>(
      "update contact_messages set resolved_at=now() where id=$1 and resolved_at is null returning org_id",
      [id],
    );
    if (!row) return { ok: false, error: "ไม่พบข้อความ (หรือปิดไปแล้ว)" };
    await logAudit(row.org_id, admin.id, "admin.contact_resolve", id);
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
