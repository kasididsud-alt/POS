import { requirePage } from "@/lib/guard";
import { PLANS, PAID_PLAN_IDS, planForOrg, type PlanDef } from "@/lib/plans";
import { isStripeConfigured, planFromPriceId } from "@/lib/stripe";
import PricingClient, { type ClientPlan } from "./PricingClient";

function toClient(p: PlanDef): ClientPlan {
  return {
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    monthly: p.monthly,
    yearly: p.yearly,
    features: p.features,
    highlight: !!p.highlight,
  };
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{
    success?: string;
    canceled?: string;
    error?: string;
    upgrade?: string;
  }>;
}) {
  const ctx = await requirePage();
  const sp = await searchParams;

  const current = planForOrg(ctx.subscription);
  const isOwner = ctx.membership?.role === "owner";
  // รอบบิลปัจจุบัน — ให้ PricingClient ปิดปุ่มเฉพาะเมื่อ "แพ็ก+รอบบิล" ตรงกัน
  // (ลูกค้าที่อยู่ Pro รายเดือนต้องสลับเป็น Pro รายปีได้ ไม่ใช่โดนบล็อกว่า "แพ็กปัจจุบัน")
  const currentInterval = ctx.subscription?.price_id
    ? (planFromPriceId(ctx.subscription.price_id)?.interval ?? null)
    : null;

  return (
    <PricingClient
      free={toClient(PLANS.free)}
      paid={PAID_PLAN_IDS.map((id) => toClient(PLANS[id]))}
      current={current}
      currentInterval={currentInterval}
      isOwner={isOwner}
      stripeReady={isStripeConfigured}
      banner={
        sp.upgrade
          ? "upgrade"
          : sp.success
            ? "success"
            : sp.canceled
              ? "canceled"
              : sp.error
                ? "error"
                : null
      }
      errorMsg={sp.error ?? null}
      upgradeNeed={sp.upgrade === "premium" ? "premium" : sp.upgrade === "pro" ? "pro" : null}
    />
  );
}
