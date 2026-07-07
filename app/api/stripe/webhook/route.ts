import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { syncSubscriptionRow } from "@/lib/billing";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

async function upsertSubscription(sub: Stripe.Subscription, eventTs: number) {
  // หา org_id จาก metadata ของ subscription หรือ customer
  let orgId: string | undefined = sub.metadata?.org_id;
  if (!orgId) {
    const stripe = getStripe();
    const customer = (await stripe.customers.retrieve(
      sub.customer as string,
    )) as Stripe.Customer;
    orgId = customer.metadata?.org_id ?? undefined;
  }
  // fallback สุดท้าย: หา org จาก stripe_customer_id ที่ checkout flow เก็บไว้เสมอ
  if (!orgId && sub.customer) {
    const { one } = await import("@/lib/db");
    const org = await one<{ id: string }>(
      "select id from organizations where stripe_customer_id = $1",
      [sub.customer as string],
    );
    orgId = org?.id;
  }
  if (!orgId) {
    // แมพ org ไม่ได้ — ห้าม ACK เงียบๆ ไม่งั้น Stripe จะไม่ retry แล้ว subscription
    // ที่ลูกค้าจ่ายเงินแล้วจะไม่ถูกบันทึกตลอดไป. โยน error → route ตอบ 500 → Stripe retry.
    console.error(
      `[stripe webhook] cannot resolve org_id for subscription ${sub.id} (customer=${sub.customer})`,
    );
    throw new Error(`unresolved org_id for subscription ${sub.id}`);
  }

  // logic upsert ลง DB ใช้ร่วมกับ checkout route — ดู lib/billing.ts
  await syncSubscriptionRow(orgId, sub, eventTs);
}

export async function POST(req: NextRequest) {
  if (!isStripeConfigured || !WEBHOOK_SECRET) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 400 });
  }

  const stripe = getStripe();
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch (e) {
    return NextResponse.json(
      { error: `signature verification failed: ${(e as Error).message}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(
            session.subscription as string,
          );
          if (session.metadata?.org_id && !sub.metadata?.org_id) {
            sub.metadata = { ...sub.metadata, org_id: session.metadata.org_id };
          }
          await upsertSubscription(sub, event.created);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await upsertSubscription(
          event.data.object as Stripe.Subscription,
          event.created,
        );
        break;
      }
      default:
        break;
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
