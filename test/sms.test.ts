import { test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeThaiPhone,
  validateSmsCredentials,
  sendSms,
} from "../lib/sms.ts";

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

test("normalizeThaiPhone แปลงเบอร์ไทยเป็นรูปแบบสากล", () => {
  assert.equal(normalizeThaiPhone("0812345678"), "66812345678");
  assert.equal(normalizeThaiPhone("081-234-5678"), "66812345678");
  assert.equal(normalizeThaiPhone("+66812345678"), "66812345678");
  assert.equal(normalizeThaiPhone("66812345678"), "66812345678");
});

test("validateSmsCredentials (thaibulksms) เช็คเครดิตด้วย Basic auth", async () => {
  const f = mockFetch(200);
  await withFetch(f, () =>
    validateSmsCredentials("thaibulksms", { apiKey: "k1", apiSecret: "s1", sender: null }),
  );
  const [url, init] = calls(f)[0]!.arguments as [string, RequestInit];
  assert.equal(url, "https://api-v2.thaibulksms.com/credit");
  assert.equal(
    (init.headers as Record<string, string>)["Authorization"],
    `Basic ${Buffer.from("k1:s1").toString("base64")}`,
  );
});

test("validateSmsCredentials (twilio) อ่านข้อมูล account ตาม SID", async () => {
  const f = mockFetch(200);
  await withFetch(f, () =>
    validateSmsCredentials("twilio", { apiKey: "AC123", apiSecret: "tok", sender: "+1415" }),
  );
  const [url] = calls(f)[0]!.arguments as [string];
  assert.equal(url, "https://api.twilio.com/2010-04-01/Accounts/AC123.json");
});

test("validateSmsCredentials โยน error เมื่อ credentials ใช้ไม่ได้", async () => {
  await withFetch(mockFetch(401), () =>
    assert.rejects(
      () =>
        validateSmsCredentials("thaibulksms", { apiKey: "bad", apiSecret: "bad", sender: null }),
      /ตรวจ credentials ไม่ผ่าน/,
    ),
  );
});

test("sendSms (thaibulksms) ส่ง msisdn ที่ normalize แล้ว + sender เมื่อระบุ", async () => {
  const f = mockFetch(200);
  await withFetch(f, () =>
    sendSms(
      "thaibulksms",
      { apiKey: "k", apiSecret: "s", sender: "MYSHOP" },
      { to: "081-234-5678", message: "ออเดอร์ส่งแล้ว" },
    ),
  );
  const [url, init] = calls(f)[0]!.arguments as [string, RequestInit];
  assert.equal(url, "https://api-v2.thaibulksms.com/sms");
  const body = new URLSearchParams(String(init.body));
  assert.equal(body.get("msisdn"), "66812345678");
  assert.equal(body.get("message"), "ออเดอร์ส่งแล้ว");
  assert.equal(body.get("sender"), "MYSHOP");
});

test("sendSms (twilio) ใส่ + นำหน้าเบอร์ และบังคับต้องมี From", async () => {
  const f = mockFetch(201);
  await withFetch(f, () =>
    sendSms(
      "twilio",
      { apiKey: "AC1", apiSecret: "t", sender: "+14155550100" },
      { to: "0812345678", message: "hi" },
    ),
  );
  const [url, init] = calls(f)[0]!.arguments as [string, RequestInit];
  assert.equal(url, "https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json");
  const body = new URLSearchParams(String(init.body));
  assert.equal(body.get("To"), "+66812345678");
  assert.equal(body.get("From"), "+14155550100");

  await withFetch(mockFetch(201), () =>
    assert.rejects(
      () =>
        sendSms("twilio", { apiKey: "AC1", apiSecret: "t", sender: null }, { to: "0812345678", message: "x" }),
      /From/,
    ),
  );
});
