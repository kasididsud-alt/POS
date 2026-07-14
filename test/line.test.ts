import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { pushLineMessage, broadcastLineMessage } from "../lib/line-api.ts";

function mockFetch(status: number, body = "") {
  return mock.fn(async () =>
    new Response(body, { status }),
  ) as unknown as typeof fetch;
}

test("pushLineMessage ยิง LINE push API ด้วย token + ปลายทาง + ข้อความที่ให้", async () => {
  const f = mockFetch(200);
  const orig = globalThis.fetch;
  globalThis.fetch = f;
  try {
    await pushLineMessage("tok-123", "U0001", "ทดสอบ");
  } finally {
    globalThis.fetch = orig;
  }

  const calls = (f as unknown as ReturnType<typeof mock.fn>).mock.calls;
  assert.equal(calls.length, 1);
  const [url, init] = calls[0]!.arguments as [string, RequestInit];
  assert.equal(url, "https://api.line.me/v2/bot/message/push");
  assert.equal(
    (init.headers as Record<string, string>)["Authorization"],
    "Bearer tok-123",
  );
  const payload = JSON.parse(String(init.body));
  assert.equal(payload.to, "U0001");
  assert.deepEqual(payload.messages, [{ type: "text", text: "ทดสอบ" }]);
});

test("broadcastLineMessage ยิง broadcast endpoint โดยไม่มีปลายทางเจาะจง", async () => {
  const f = mockFetch(200);
  const orig = globalThis.fetch;
  globalThis.fetch = f;
  try {
    await broadcastLineMessage("tok-b", "โปรมาแล้ว");
  } finally {
    globalThis.fetch = orig;
  }

  const calls = (f as unknown as ReturnType<typeof mock.fn>).mock.calls;
  const [url, init] = calls[0]!.arguments as [string, RequestInit];
  assert.equal(url, "https://api.line.me/v2/bot/message/broadcast");
  const payload = JSON.parse(String(init.body));
  assert.equal(payload.to, undefined);
  assert.deepEqual(payload.messages, [{ type: "text", text: "โปรมาแล้ว" }]);
});

test("pushLineMessage โยน error พร้อม status เมื่อ LINE ตอบไม่ ok", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = mockFetch(401, '{"message":"invalid token"}');
  try {
    await assert.rejects(
      () => pushLineMessage("bad", "U0001", "x"),
      /LINE API 401/,
    );
  } finally {
    globalThis.fetch = orig;
  }
});
