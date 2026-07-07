import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolvePlanChange,
  changePlanOrCheckout,
  shouldApplyEvent,
  resolvePlanWithComp,
  type ExistingSubscription,
  type StripeSubscriptionLite,
  type SubscriptionUpdateParamsLite,
} from "../lib/billing.ts";
import { planAllowsPath } from "../components/nav.ts";

// ---------- fake Stripe: จับว่าเมธอดไหนถูกเรียกด้วยพารามิเตอร์อะไร ----------

function fakeStripe(live: StripeSubscriptionLite | null) {
  const calls = {
    retrieve: [] as string[],
    update: [] as Array<{ id: string; params: SubscriptionUpdateParamsLite }>,
    checkoutCreate: 0,
  };
  const stripe = {
    subscriptions: {
      async retrieve(id: string): Promise<StripeSubscriptionLite> {
        calls.retrieve.push(id);
        if (!live) {
          const err = new Error("No such subscription") as Error & { code?: string };
          err.code = "resource_missing";
          throw err;
        }
        return live;
      },
      async update(
        id: string,
        params: SubscriptionUpdateParamsLite,
      ): Promise<StripeSubscriptionLite> {
        calls.update.push({ id, params });
        return {
          ...live!,
          cancel_at_period_end: false,
          items: {
            data: [
              {
                id: params.items[0].id,
                price: { id: params.items[0].price },
                current_period_end: live!.items.data[0]?.current_period_end,
              },
            ],
          },
        };
      },
    },
    // changePlanOrCheckout ต้องไม่เรียกอันนี้เด็ดขาด — การเปิด checkout เป็นหน้าที่ route
    // (route เปิดเฉพาะเมื่อ outcome === "checkout")
    checkout: {
      sessions: {
        async create() {
          calls.checkoutCreate++;
          return { url: "https://stripe.test/session" };
        },
      },
    },
  };
  return { stripe, calls };
}

const activeRow = (over: Partial<ExistingSubscription> = {}): ExistingSubscription => ({
  stripe_subscription_id: "sub_1",
  status: "active",
  price_id: "price_old",
  ...over,
});

const liveSub = (over: Partial<StripeSubscriptionLite> = {}): StripeSubscriptionLite => ({
  id: "sub_1",
  status: "active",
  cancel_at_period_end: false,
  items: { data: [{ id: "si_1", price: { id: "price_old" }, current_period_end: 1893456000 }] },
  ...over,
});

const META = { orgId: "org_1", plan: "premium" };

// ---------- resolvePlanChange (pure decision) ----------

test("resolvePlanChange: ไม่มี subscription → checkout", () => {
  assert.equal(resolvePlanChange(null, "price_new"), "checkout");
});

test("resolvePlanChange: trial ภายในระบบ (ไม่มี stripe_subscription_id) → checkout", () => {
  assert.equal(
    resolvePlanChange(
      { stripe_subscription_id: null, status: "trialing", price_id: null },
      "price_new",
    ),
    "checkout",
  );
});

test("resolvePlanChange: sub canceled → checkout (สร้างใหม่ได้ ไม่ซ้อน)", () => {
  assert.equal(resolvePlanChange(activeRow({ status: "canceled" }), "price_new"), "checkout");
});

test("resolvePlanChange: sub active + price เดิม → noop", () => {
  assert.equal(resolvePlanChange(activeRow(), "price_old"), "noop");
});

test("resolvePlanChange: sub active + price ใหม่ → update", () => {
  assert.equal(resolvePlanChange(activeRow(), "price_new"), "update");
});

test("resolvePlanChange: past_due ก็ยังถือว่ามี sub อยู่ → update (ห้ามเปิด checkout ซ้อน)", () => {
  assert.equal(resolvePlanChange(activeRow({ status: "past_due" }), "price_new"), "update");
});

// ---------- changePlanOrCheckout (คุย Stripe ผ่าน client ที่ inject เข้ามา) ----------

test("มี sub active + ขอ price ใหม่ → เรียก subscriptions.update ไม่ใช่ checkout.sessions.create", async () => {
  const { stripe, calls } = fakeStripe(liveSub());
  const r = await changePlanOrCheckout(stripe, activeRow(), "price_new", META);

  assert.equal(r.outcome, "updated");
  assert.equal(calls.update.length, 1);
  assert.equal(calls.checkoutCreate, 0);

  const u = calls.update[0];
  assert.equal(u.id, "sub_1");
  assert.deepEqual(u.params.items, [{ id: "si_1", price: "price_new" }]);
  assert.equal(u.params.proration_behavior, "create_prorations");
  assert.deepEqual(u.params.metadata, { org_id: "org_1", plan: "premium" });
  // subscription ที่คืนมาต้องเป็น price ใหม่ (route เอาไป sync DB ทันที)
  if (r.outcome === "updated") {
    assert.equal(r.subscription.items.data[0].price.id, "price_new");
  }
});

test("มี sub active + ขอ price เดิม → noop ไม่แตะ Stripe เลย", async () => {
  const { stripe, calls } = fakeStripe(liveSub());
  const r = await changePlanOrCheckout(stripe, activeRow(), "price_old", META);

  assert.equal(r.outcome, "noop");
  assert.equal(calls.retrieve.length, 0);
  assert.equal(calls.update.length, 0);
  assert.equal(calls.checkoutCreate, 0);
});

test("sub ใน DB เป็น canceled → ไปทาง checkout โดยไม่เรียก Stripe", async () => {
  const { stripe, calls } = fakeStripe(liveSub());
  const r = await changePlanOrCheckout(
    stripe,
    activeRow({ status: "canceled" }),
    "price_new",
    META,
  );

  assert.equal(r.outcome, "checkout");
  assert.equal(calls.retrieve.length, 0);
  assert.equal(calls.update.length, 0);
});

test("ไม่มี sub เลย → ไปทาง checkout", async () => {
  const { stripe, calls } = fakeStripe(liveSub());
  const r = await changePlanOrCheckout(stripe, null, "price_new", META);

  assert.equal(r.outcome, "checkout");
  assert.equal(calls.retrieve.length, 0);
  assert.equal(calls.update.length, 0);
});

test("DB บอก active แต่ Stripe บอก canceled แล้ว → fall through ไป checkout", async () => {
  const { stripe, calls } = fakeStripe(liveSub({ status: "canceled" }));
  const r = await changePlanOrCheckout(stripe, activeRow(), "price_new", META);

  assert.equal(r.outcome, "checkout");
  assert.equal(calls.retrieve.length, 1);
  assert.equal(calls.update.length, 0);
});

test("subscription id ไม่มีอยู่บน Stripe (resource_missing) → fall through ไป checkout", async () => {
  const { stripe, calls } = fakeStripe(null); // retrieve จะ throw code=resource_missing
  const r = await changePlanOrCheckout(stripe, activeRow(), "price_new", META);

  assert.equal(r.outcome, "checkout");
  assert.equal(calls.retrieve.length, 1);
  assert.equal(calls.update.length, 0);
});

test("เคยกดยกเลิกค้างไว้ (cancel_at_period_end) + เปลี่ยน price → update ต้องเคลียร์เป็น false", async () => {
  const { stripe, calls } = fakeStripe(liveSub({ cancel_at_period_end: true }));
  const r = await changePlanOrCheckout(stripe, activeRow(), "price_new", META);

  assert.equal(r.outcome, "updated");
  assert.equal(calls.update.length, 1);
  assert.equal(calls.update[0].params.cancel_at_period_end, false);
});

test("cancel_at_period_end ค้างอยู่แม้ price บน Stripe ตรงกับที่ขอแล้ว → ยังต้อง update เพื่อเคลียร์", async () => {
  // DB stale (price_id เก่า) แต่บน Stripe เป็น price ใหม่แล้ว + มี cancel ค้าง
  const { stripe, calls } = fakeStripe(
    liveSub({
      cancel_at_period_end: true,
      items: { data: [{ id: "si_1", price: { id: "price_new" } }] },
    }),
  );
  const r = await changePlanOrCheckout(stripe, activeRow(), "price_new", META);

  assert.equal(r.outcome, "updated");
  assert.equal(calls.update.length, 1);
  assert.equal(calls.update[0].params.cancel_at_period_end, false);
});

test("DB stale แต่บน Stripe เป็น price ที่ขออยู่แล้ว (ไม่มี cancel ค้าง) → ไม่เรียก update แค่ sync กลับ", async () => {
  const { stripe, calls } = fakeStripe(
    liveSub({ items: { data: [{ id: "si_1", price: { id: "price_new" } }] } }),
  );
  const r = await changePlanOrCheckout(stripe, activeRow(), "price_new", META);

  assert.equal(r.outcome, "updated");
  assert.equal(calls.update.length, 0);
  if (r.outcome === "updated") {
    assert.equal(r.subscription.items.data[0].price.id, "price_new");
  }
});

// ---------- shouldApplyEvent (webhook ordering/idempotency guard, pure) ----------

test("shouldApplyEvent: แถวยังไม่มี event_ts (null) → apply ได้เสมอ", () => {
  assert.equal(shouldApplyEvent(null, 1000), true);
});

test("shouldApplyEvent: event ใหม่กว่า → apply", () => {
  assert.equal(shouldApplyEvent(1000, 2000), true);
});

test("shouldApplyEvent: event เก่ากว่า → ข้าม (กันฟื้น sub ที่ยกเลิกแล้ว/ทับ sub ใหม่ด้วยตัวเก่า)", () => {
  assert.equal(shouldApplyEvent(2000, 1000), false);
});

test("shouldApplyEvent: event เวลาเท่ากัน (re-delivery ตัวเดิม) → apply แบบ idempotent", () => {
  assert.equal(shouldApplyEvent(1500, 1500), true);
});

// ---------- resolvePlanWithComp (comp_plan = floor เท่านั้น, pure) ----------

test("resolvePlanWithComp: ไม่มี comp → ได้แพ็กจริง", () => {
  assert.equal(resolvePlanWithComp("premium", null), "premium");
  assert.equal(resolvePlanWithComp("free", undefined), "free");
});

test("resolvePlanWithComp: comp สูงกว่าแพ็กจริง → ยกระดับ (แถม)", () => {
  assert.equal(resolvePlanWithComp("free", "pro"), "pro");
  assert.equal(resolvePlanWithComp("pro", "premium"), "premium");
});

test("resolvePlanWithComp: comp='free' ทับ Stripe Premium จริง → ต้องคงเป็น premium (ห้ามล็อกลูกค้าที่จ่ายเงินเป็น free)", () => {
  assert.equal(resolvePlanWithComp("premium", "free"), "premium");
  assert.equal(resolvePlanWithComp("pro", "free"), "pro");
});

test("resolvePlanWithComp: comp ต่ำกว่าแพ็กจริง → ไม่ลด (คงแพ็กจริง)", () => {
  assert.equal(resolvePlanWithComp("premium", "pro"), "premium");
});

test("resolvePlanWithComp: comp เท่ากับแพ็กจริง → เท่าเดิม", () => {
  assert.equal(resolvePlanWithComp("pro", "pro"), "pro");
});

test("resolvePlanWithComp: comp ค่าขยะ → ไม่สน คืนแพ็กจริง", () => {
  assert.equal(resolvePlanWithComp("pro", "bogus"), "pro");
});

// ---------- plan gating: แพ็กต่ำห้ามเข้า path จ่ายเงิน (สัญญาที่ server action guard ใช้) ----------

test("plan gating: free ห้ามเข้า /branches, /integrations (Premium-only)", () => {
  assert.equal(planAllowsPath("free", "/branches"), false);
  assert.equal(planAllowsPath("free", "/integrations"), false);
  assert.equal(planAllowsPath("pro", "/branches"), false);
});

test("plan gating: premium เข้าฟีเจอร์ Premium ได้", () => {
  assert.equal(planAllowsPath("premium", "/branches"), true);
  assert.equal(planAllowsPath("premium", "/integrations"), true);
});
