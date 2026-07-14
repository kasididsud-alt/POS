import { test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  validateGatewayKey,
  createPaymentLink,
  createPromptPayCharge,
  getChargeStatus,
} from "../lib/payment-gateway.ts";

function mockFetch(status: number, body = "{}") {
  return mock.fn(async () =>
    new Response(body, { status }),
  ) as unknown as typeof fetch;
}

function calls(f: typeof fetch) {
  return (f as unknown as ReturnType<typeof mock.fn>).mock.calls;
}

async function withFetch<T>(f: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const orig = globalThis.fetch;
  globalThis.fetch = f;
  try {
    return await fn();
  } finally {
    globalThis.fetch = orig;
  }
}

test("validateGatewayKey (stripe) ยิง /v1/balance ด้วย Bearer", async () => {
  const f = mockFetch(200);
  await withFetch(f, () => validateGatewayKey("stripe", "sk_test_x"));
  const [url, init] = calls(f)[0]!.arguments as [string, RequestInit];
  assert.equal(url, "https://api.stripe.com/v1/balance");
  assert.equal(
    (init.headers as Record<string, string>)["Authorization"],
    "Bearer sk_test_x",
  );
});

test("validateGatewayKey (omise) ยิง /account ด้วย Basic auth", async () => {
  const f = mockFetch(200);
  await withFetch(f, () => validateGatewayKey("omise", "skey_test_x"));
  const [url, init] = calls(f)[0]!.arguments as [string, RequestInit];
  assert.equal(url, "https://api.omise.co/account");
  assert.equal(
    (init.headers as Record<string, string>)["Authorization"],
    `Basic ${Buffer.from("skey_test_x:").toString("base64")}`,
  );
});

test("validateGatewayKey โยน error เมื่อ key ใช้ไม่ได้", async () => {
  await withFetch(mockFetch(401, '{"error":"invalid"}'), () =>
    assert.rejects(() => validateGatewayKey("stripe", "bad"), /ตรวจ key ไม่ผ่าน/),
  );
});

test("createPaymentLink (stripe) สร้าง checkout session สกุล THB ยอดเป็นสตางค์", async () => {
  const f = mockFetch(200, '{"url":"https://checkout.stripe.com/c/pay/x"}');
  const url = await withFetch(f, () =>
    createPaymentLink("stripe", "sk_test_x", {
      amountSatang: 150000,
      description: "ออเดอร์ SO-001",
    }),
  );
  assert.equal(url, "https://checkout.stripe.com/c/pay/x");
  const [reqUrl, init] = calls(f)[0]!.arguments as [string, RequestInit];
  assert.equal(reqUrl, "https://api.stripe.com/v1/checkout/sessions");
  const body = new URLSearchParams(String(init.body));
  assert.equal(body.get("line_items[0][price_data][currency]"), "thb");
  assert.equal(body.get("line_items[0][price_data][unit_amount]"), "150000");
  assert.equal(body.get("mode"), "payment");
});

test("createPaymentLink (omise) สร้าง link แล้วคืน payment_uri", async () => {
  const f = mockFetch(200, '{"payment_uri":"https://pay.omise.co/x"}');
  const url = await withFetch(f, () =>
    createPaymentLink("omise", "skey_test_x", {
      amountSatang: 150000,
      description: "ออเดอร์ SO-001",
    }),
  );
  assert.equal(url, "https://pay.omise.co/x");
  const [reqUrl, init] = calls(f)[0]!.arguments as [string, RequestInit];
  assert.equal(reqUrl, "https://api.omise.co/links");
  const body = new URLSearchParams(String(init.body));
  assert.equal(body.get("amount"), "150000");
  assert.equal(body.get("currency"), "thb");
});

test("createPromptPayCharge (omise) สร้าง charge แบบ source promptpay แล้วคืน QR + id", async () => {
  const f = mockFetch(
    200,
    '{"id":"chrg_1","source":{"scannable_code":{"image":{"download_uri":"https://omise.co/qr.png"}}}}',
  );
  const charge = await withFetch(f, () =>
    createPromptPayCharge("omise", "skey_x", { amountSatang: 5000, description: "POS ร้าน" }),
  );
  assert.deepEqual(charge, { chargeId: "chrg_1", qrImage: "https://omise.co/qr.png" });
  const [url, init] = calls(f)[0]!.arguments as [string, RequestInit];
  assert.equal(url, "https://api.omise.co/charges");
  const body = new URLSearchParams(String(init.body));
  assert.equal(body.get("source[type]"), "promptpay");
  assert.equal(body.get("amount"), "5000");
});

test("createPromptPayCharge (stripe) confirm payment intent แล้วดึง QR จาก next_action", async () => {
  const f = mockFetch(
    200,
    '{"id":"pi_1","next_action":{"promptpay_display_qr_code":{"image_url_png":"https://stripe.com/qr.png"}}}',
  );
  const charge = await withFetch(f, () =>
    createPromptPayCharge("stripe", "sk_x", { amountSatang: 5000, description: "POS ร้าน" }),
  );
  assert.deepEqual(charge, { chargeId: "pi_1", qrImage: "https://stripe.com/qr.png" });
  const [url, init] = calls(f)[0]!.arguments as [string, RequestInit];
  assert.equal(url, "https://api.stripe.com/v1/payment_intents");
  const body = new URLSearchParams(String(init.body));
  assert.equal(body.get("payment_method_types[]"), "promptpay");
  assert.equal(body.get("confirm"), "true");
});

test("getChargeStatus แปลงสถานะของแต่ละเจ้าเป็น pending/paid/failed", async () => {
  assert.equal(
    await withFetch(mockFetch(200, '{"status":"successful","paid":true}'), () =>
      getChargeStatus("omise", "k", "chrg_1"),
    ),
    "paid",
  );
  assert.equal(
    await withFetch(mockFetch(200, '{"status":"pending"}'), () =>
      getChargeStatus("omise", "k", "chrg_1"),
    ),
    "pending",
  );
  assert.equal(
    await withFetch(mockFetch(200, '{"status":"expired"}'), () =>
      getChargeStatus("omise", "k", "chrg_1"),
    ),
    "failed",
  );
  assert.equal(
    await withFetch(mockFetch(200, '{"status":"succeeded"}'), () =>
      getChargeStatus("stripe", "k", "pi_1"),
    ),
    "paid",
  );
  assert.equal(
    await withFetch(mockFetch(200, '{"status":"requires_action"}'), () =>
      getChargeStatus("stripe", "k", "pi_1"),
    ),
    "pending",
  );
});

test("createPaymentLink กันยอดต่ำกว่าขั้นต่ำ/ยอดไม่เป็นจำนวนเต็มสตางค์", async () => {
  const f = mockFetch(200);
  await withFetch(f, async () => {
    await assert.rejects(
      () => createPaymentLink("stripe", "k", { amountSatang: 1999, description: "x" }),
      /ขั้นต่ำ/,
    );
    await assert.rejects(
      () => createPaymentLink("stripe", "k", { amountSatang: 2000.5, description: "x" }),
      /ขั้นต่ำ/,
    );
  });
  assert.equal(calls(f).length, 0); // ไม่ควรยิง API เลย
});
