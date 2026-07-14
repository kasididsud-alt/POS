/**
 * LINE Messaging API client (pure — ไม่แตะ DB, unit-test ได้ตรงๆ)
 * LINE Notify ปิดบริการแล้ว จึง push ผ่าน LINE OA แทน:
 * ร้านต้องมี LINE OA + channel access token และรู้ userId/groupId ปลายทาง
 */
const LINE_API_BASE = "https://api.line.me/v2/bot";

async function linePost(
  channelToken: string,
  path: string,
  payload: unknown,
): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelToken}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LINE API ${res.status}: ${body.slice(0, 300)}`);
  }
}

/** ส่งข้อความหาปลายทางเดียว (userId/groupId) — โยน Error ถ้าส่งไม่สำเร็จ */
export async function pushLineMessage(
  channelToken: string,
  to: string,
  text: string,
): Promise<void> {
  await linePost(channelToken, "/message/push", {
    to,
    messages: [{ type: "text", text }],
  });
}

/** broadcast หา "เพื่อนทุกคน" ของ OA — ใช้ส่งโปรโมชั่นหาลูกค้า (นับโควตาข้อความ × จำนวนเพื่อน) */
export async function broadcastLineMessage(
  channelToken: string,
  text: string,
): Promise<void> {
  await linePost(channelToken, "/message/broadcast", {
    messages: [{ type: "text", text }],
  });
}
