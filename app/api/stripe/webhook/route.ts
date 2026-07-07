import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { syncSubscriptionRow } from "@/lib/billing";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

async function upsertSubscription(sub: Stripe.Subscription) {
  // หา org_id จาก metadata ของ subscription หรือ customer
  let orgId = sub.metadata?.org_id;
  if (!orgId) {
    const stripe = getStripe();
    const customer = (await stripe.customers.retrieve(
      sub.customer as string,
    )) as Stripe.Customer;
    orgId = customer.metadata?.org_id;
  }
  if (!orgId) return;

  // logic upsert ลง DB ใช้ร่วมกับ checkout route — ดู lib/billing.ts
  await syncSubscriptionRow(orgId, sub);
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
          await upsertSubscription(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await upsertSubscription(event.data.object as Stripe.Subscription);
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
