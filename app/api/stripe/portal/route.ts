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

  // Billing Portal = ยกเลิก/เปลี่ยนแพ็ก/เปลี่ยนบัตร = เรื่องเงิน — เฉพาะเจ้าของร้าน
  // (ปุ่มถูกซ่อนฝั่ง UI ด้วย isOwner แต่ endpoint นี้เรียกตรงได้ ต้องบังคับฝั่ง server)
  if (ctx.membership?.role !== "owner") {
    return NextResponse.redirect(
      `${SITE_URL}/settings?error=${encodeURIComponent(
        "เฉพาะเจ้าของร้านเท่านั้นที่จัดการการชำระเงินได้",
      )}`,
      303,
    );
  }

  const stripe = getStripe();
  const customerId = await ensureStripeCustomer(ctx.org, ctx.email);

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${SITE_URL}/settings`,
  });

  return NextResponse.redirect(session.url, 303);
}
