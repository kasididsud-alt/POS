import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/auth";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { ensureStripeCustomer, SITE_URL } from "@/lib/billing";

export async function POST() {
  if (!isStripeConfigured) {
    return NextResponse.redirect(
      `${SITE_URL}/settings?error=${encodeURIComponent("ยังไม่ได้ตั้งค่า Stripe")}`,
      303,
    );
  }

  const ctx = await getAppContext();
  if (!ctx?.org) return NextResponse.redirect(`${SITE_URL}/login`, 303);

  const stripe = getStripe();
  const customerId = await ensureStripeCustomer(ctx.org, ctx.email);

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${SITE_URL}/settings`,
  });

  return NextResponse.redirect(session.url, 303);
}
