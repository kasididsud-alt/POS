import type { Organization, Subscription } from "@/lib/types";

// หมายเหตุเรื่องโครงสร้าง: ไฟล์นี้ถูก import ตรง ๆ ใน test/ (node --test ซึ่ง resolve
// alias "@/" ไม่ได้) — logic การตัดสินใจจึงเป็น pure function, ฟังก์ชันที่คุยกับ Stripe
// รับ client เป็นพารามิเตอร์ (inject fake ได้) และโมดูล DB/Stripe ถูก import แบบ lazy
// เฉพาะในฟังก์ชันที่แตะของจริง เพื่อไม่ให้การ import โมดูลนี้ลาก dependency มาด้วย

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** หา/สร้าง Stripe customer ของร้าน แล้วเก็บ id ลง organizations */
export async function ensureStripeCustomer(
  org: Organization,
  email: string | null,
): Promise<string> {
  if (org.stripe_customer_id) return org.stripe_customer_id;

  const [{ getStripe }, { query }] = await Promise.all([
    import("@/lib/stripe"),
    import("@/lib/db"),
  ]);

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: org.name,
    email: email ?? undefined,
    metadata: { org_id: org.id },
  });

  await query("update organizations set stripe_customer_id = $1 where id = $2", [
    customer.id,
    org.id,
  ]);

  return customer.id;
}

// ============================================================
// กัน Stripe subscription ซ้อน: ถ้า org มี subscription ใช้งานอยู่
// ให้เปลี่ยน price บนตัวเดิมแทนการเปิด Checkout สร้างตัวใหม่
// ============================================================

/** สถานะใน DB ที่ถือว่า subscription เดิมยังมีผล — ห้ามเปิด checkout ซ้อน */
const REUSABLE_DB_STATUSES = new Set<string>(["active", "trialing", "past_due"]);

/** สถานะบน Stripe ที่ถือว่า subscription ตายแล้ว (แก้ price ต่อไม่ได้ — ต้องเปิด checkout ใหม่) */
const DEAD_STRIPE_STATUSES = new Set<string>(["canceled", "incomplete_expired"]);

export type ExistingSubscription = Pick<
  Subscription,
  "stripe_subscription_id" | "status" | "price_id"
>;

export type PlanChangeAction = "checkout" | "update" | "noop";

/**
 * ตัดสินจากแถว subscriptions ใน DB ว่า request เปลี่ยนแพ็กควรทำอะไร (pure — ไม่แตะ Stripe/DB)
 * - "noop"     → เป็นแพ็ก/price นี้อยู่แล้ว
 * - "update"   → มี subscription ใช้งานอยู่ → เปลี่ยน price บนตัวเดิม
 * - "checkout" → ไม่มี subscription จริงบน Stripe (เช่น trial ภายในระบบ) → เปิด Checkout
 */
export function resolvePlanChange(
  existing: ExistingSubscription | null,
  requestedPriceId: string,
): PlanChangeAction {
  if (!existing?.stripe_subscription_id) return "checkout";
  if (!REUSABLE_DB_STATUSES.has(existing.status)) return "checkout";
  if (existing.price_id === requestedPriceId) return "noop";
  return "update";
}

/** subset ของ Stripe.Subscription เท่าที่ flow นี้ใช้ — โครงตรงกับของจริง จึง fake ในเทสต์ได้ */
export type StripeSubscriptionLite = {
  id: string;
  status: string;
  cancel_at_period_end?: boolean;
  /** Stripe API เก่า: period end อยู่บน subscription */
  current_period_end?: number;
  items: {
    data: Array<{
      id: string;
      price: { id: string };
      /** Stripe API ใหม่: period end อยู่บน subscription item */
      current_period_end?: number;
    }>;
  };
};

export type SubscriptionUpdateParamsLite = {
  items: Array<{ id: string; price: string }>;
  proration_behavior: "create_prorations";
  cancel_at_period_end: boolean;
  metadata: { org_id: string; plan: string };
};

/** เฉพาะเมธอด Stripe ที่ flow เปลี่ยนแพ็กใช้ — รับเป็นพารามิเตอร์เพื่อ inject fake ในเทสต์ */
export type PlanChangeStripeClient = {
  subscriptions: {
    retrieve(id: string): Promise<StripeSubscriptionLite>;
    update(
      id: string,
      params: SubscriptionUpdateParamsLite,
    ): Promise<StripeSubscriptionLite>;
  };
};

export type PlanChangeOutcome =
  | { outcome: "noop" }
  | { outcome: "checkout" }
  | { outcome: "updated"; subscription: StripeSubscriptionLite };

/**
 * ตัดสิน + ลงมือเปลี่ยนแพ็กบน subscription เดิม (กัน subscription ซ้อน)
 * - "noop"     → เป็นแพ็กนี้อยู่แล้ว caller ไม่ต้องทำอะไร
 * - "checkout" → ไม่มี subscription ที่ยังใช้ได้ → caller เปิด Stripe Checkout ตามปกติ
 * - "updated"  → เปลี่ยน price บนตัวเดิมสำเร็จ → caller sync DB แล้ว redirect success
 */
export async function changePlanOrCheckout(
  stripe: PlanChangeStripeClient,
  existing: ExistingSubscription | null,
  requestedPriceId: string,
  meta: { orgId: string; plan: string },
): Promise<PlanChangeOutcome> {
  const action = resolvePlanChange(existing, requestedPriceId);
  if (action === "noop") return { outcome: "noop" };
  if (action === "checkout" || !existing?.stripe_subscription_id) {
    return { outcome: "checkout" };
  }

  // เช็คสถานะจริงบน Stripe ก่อนแก้ — แถวใน DB อาจ stale ถ้า webhook ยังไม่วิ่ง
  let live: StripeSubscriptionLite;
  try {
    live = await stripe.subscriptions.retrieve(existing.stripe_subscription_id);
  } catch (e) {
    // id ไม่มีอยู่บน Stripe (เช่น ข้อมูลค้างจากคนละ mode/environment) → เปิด checkout ใหม่
    if ((e as { code?: string })?.code === "resource_missing") {
      return { outcome: "checkout" };
    }
    throw e;
  }
  if (DEAD_STRIPE_STATUSES.has(live.status)) return { outcome: "checkout" };

  const item = live.items.data[0];
  // subscription จริงมี item เสมอ — เจอไม่มี = ข้อมูลผิดปกติ ปล่อยไปทาง checkout ปลอดภัยกว่าเดา
  if (!item) return { outcome: "checkout" };

  if (item.price.id === requestedPriceId && !live.cancel_at_period_end) {
    // บน Stripe เป็น price นี้อยู่แล้ว (DB stale) — ไม่ต้อง update แค่ให้ caller sync กลับ
    return { outcome: "updated", subscription: live };
  }

  const updated = await stripe.subscriptions.update(live.id, {
    items: [{ id: item.id, price: requestedPriceId }],
    // คิดเงินส่วนต่างตามสัดส่วนเวลาที่เหลือ (มาตรฐาน upgrade/downgrade)
    proration_behavior: "create_prorations",
    // เคลียร์กรณีเคยกดยกเลิกค้างไว้ — ลูกค้าเลือกแพ็กใหม่ = ตั้งใจใช้ต่อ
    cancel_at_period_end: false,
    metadata: { org_id: meta.orgId, plan: meta.plan },
  });
  return { outcome: "updated", subscription: updated };
}

/**
 * เขียนสถานะ subscription ของ org ลงตาราง subscriptions (upsert on conflict org_id)
 * — ใช้ร่วมกันระหว่าง Stripe webhook และ checkout route (route sync ทันที ไม่รอ webhook)
 */
export async function syncSubscriptionRow(
  orgId: string,
  sub: StripeSubscriptionLite,
): Promise<void> {
  const { query } = await import("@/lib/db");

  const item = sub.items.data[0];
  // current_period_end อยู่บน subscription item (Stripe API ใหม่) หรือ subscription (เก่า)
  const periodEnd = item?.current_period_end ?? sub.current_period_end ?? null;

  await query(
    `insert into subscriptions (org_id, stripe_subscription_id, status, price_id, current_period_end, updated_at)
     values ($1,$2,$3,$4,$5, now())
     on conflict (org_id) do update set
       stripe_subscription_id = excluded.stripe_subscription_id,
       status = excluded.status,
       price_id = excluded.price_id,
       current_period_end = excluded.current_period_end,
       updated_at = now()`,
    [
      orgId,
      sub.id,
      sub.status,
      item?.price?.id ?? null,
      periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    ],
  );
}

export { SITE_URL };
