import { NextResponse, type NextRequest } from "next/server";
import { getAppContext } from "@/lib/auth";
import {
  getStripe,
  isStripeConfigured,
  priceIdFor,
  type PaidPlanId,
  type BillingInterval,
} from "@/lib/stripe";
import {
  changePlanOrCheckout,
  ensureStripeCustomer,
  syncSubscriptionRow,
  SITE_URL,
} from "@/lib/billing";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured) {
    return NextResponse.redirect(
      `${SITE_URL}/billing?error=${encodeURIComponent("ยังไม่ได้ตั้งค่า Stripe")}`,
      303,
    );
  }

  const ctx = await getAppContext();
  if (!ctx?.org) {
    return NextResponse.redirect(`${SITE_URL}/login`, 303);
  }

  // เปลี่ยนแพ็กเกจ = เรื่องเงิน — เฉพาะเจ้าของร้านเท่านั้น
  // (ปุ่มใน PricingClient ถูก disable ฝั่ง client แต่ต้องบังคับฝั่ง server ด้วย)
  if (ctx.membership?.role !== "owner") {
    return NextResponse.redirect(
      `${SITE_URL}/billing?error=${encodeURIComponent(
        "เฉพาะเจ้าของร้านเท่านั้นที่เปลี่ยนแพ็กเกจได้",
      )}`,
      303,
    );
  }

  const form = await req.formData();
  const rawPlan = String(form.get("plan") ?? "pro");
  const rawInterval = String(form.get("interval") ?? "monthly");

  // รองรับค่าเก่า (plan=monthly/yearly ของแพ็กเดียว → ถือเป็น Pro)
  let plan: PaidPlanId = rawPlan === "premium" ? "premium" : "pro";
  let interval: BillingInterval = rawInterval === "yearly" ? "yearly" : "monthly";
  if (rawPlan === "monthly" || rawPlan === "yearly") {
    plan = "pro";
    interval = rawPlan === "yearly" ? "yearly" : "monthly";
  }

  const price = priceIdFor(plan, interval);

  if (!price) {
    return NextResponse.redirect(
      `${SITE_URL}/billing?error=${encodeURIComponent("ยังไม่ได้ตั้งค่า Price ID ของแพ็กนี้")}`,
      303,
    );
  }

  const stripe = getStripe();

  // กัน subscription ซ้อน: ถ้า org มี subscription ใช้งานอยู่แล้ว
  // ให้เปลี่ยน price บนตัวเดิมแทนการเปิด Checkout สร้างตัวที่สอง
  const change = await changePlanOrCheckout(stripe, ctx.subscription, price, {
    orgId: ctx.org.id,
    plan,
  });

  if (change.outcome === "noop") {
    // เป็นแพ็ก/รอบบิลนี้อยู่แล้ว — ไม่ต้องทำอะไร
    return NextResponse.redirect(`${SITE_URL}/billing`, 303);
  }

  if (change.outcome === "updated") {
    // sync DB ทันทีจาก subscription ที่ Stripe คืนมา — dev อาจไม่มี webhook วิ่ง
    await syncSubscriptionRow(ctx.org.id, change.subscription);
    return NextResponse.redirect(`${SITE_URL}/billing?success=1`, 303);
  }

  // outcome === "checkout" — ไม่มี subscription เดิมให้แก้ → เปิด Stripe Checkout ตามปกติ
  const customerId = await ensureStripeCustomer(ctx.org, ctx.email);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    subscription_data: { metadata: { org_id: ctx.org.id, plan } },
    metadata: { org_id: ctx.org.id, plan },
    success_url: `${SITE_URL}/billing?success=1`,
    cancel_url: `${SITE_URL}/billing?canceled=1`,
  });

  return NextResponse.redirect(session.url!, 303);
}
