import Stripe from "stripe";

export const isStripeConfigured = (process.env.STRIPE_SECRET_KEY ?? "").length > 0;

/** Stripe server SDK (สร้างแบบ lazy เพื่อไม่พังตอนยังไม่ใส่คีย์) */
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

export const PRICE_MONTHLY = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY ?? "";
export const PRICE_YEARLY = process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY ?? "";

// ---- Price IDs ต่อแพ็ก (Pro / Premium × รายเดือน/รายปี) ----
// Pro fallback มาที่ PRICE_MONTHLY/YEARLY เดิม เพื่อไม่ให้ config เก่าพัง
export const PRICE_PRO_MONTHLY =
  process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY || PRICE_MONTHLY;
export const PRICE_PRO_YEARLY =
  process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY || PRICE_YEARLY;
export const PRICE_PREMIUM_MONTHLY =
  process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_MONTHLY ?? "";
export const PRICE_PREMIUM_YEARLY =
  process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_YEARLY ?? "";

export type PaidPlanId = "pro" | "premium";
export type BillingInterval = "monthly" | "yearly";

const PRICE_TABLE: Record<PaidPlanId, Record<BillingInterval, string>> = {
  pro: { monthly: PRICE_PRO_MONTHLY, yearly: PRICE_PRO_YEARLY },
  premium: { monthly: PRICE_PREMIUM_MONTHLY, yearly: PRICE_PREMIUM_YEARLY },
};

/** Stripe price id ของแพ็ก+รอบบิล (คืน "" ถ้ายังไม่ตั้งค่า) */
export function priceIdFor(plan: PaidPlanId, interval: BillingInterval): string {
  return PRICE_TABLE[plan]?.[interval] ?? "";
}

/** map ย้อนกลับ: price id → แพ็ก/รอบบิล (ใช้รู้ว่า subscription อยู่แพ็กไหน) */
export function planFromPriceId(
  priceId: string,
): { plan: PaidPlanId; interval: BillingInterval } | null {
  if (!priceId) return null;
  for (const plan of ["pro", "premium"] as PaidPlanId[]) {
    for (const interval of ["monthly", "yearly"] as BillingInterval[]) {
      if (PRICE_TABLE[plan][interval] === priceId) return { plan, interval };
    }
  }
  return null;
}
