import { type NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";
import { one } from "@/lib/db";
import { planForOrg, PLANS } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import type { Subscription } from "@/lib/types";

// เพดานคำขอต่อ IP/นาที ที่บังคับ "ก่อน" ยืนยันตัวตน — backstop สำหรับ request ที่
// key ผิด/ไม่มี key (401) ซึ่งไม่มี org ให้ผูก per-key limit ได้ กัน DB โดน flood
// ตั้งไว้ ≥ เพดานแพ็กสูงสุด (Premium) เพื่อไม่รบกวน client ที่ยิงถี่ด้วย key ถูกต้อง
const API_IP_RPM = 2000;

// req.ip / req.geo ถูกถอดออกตั้งแต่ Next v15 → ดึง IP จาก header ของ reverse proxy
function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function rateLimited(resetAt: number, msg: string): NextResponse {
  return NextResponse.json(
    { error: "rate_limited", message: msg },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))),
      },
    },
  );
}

export type V1Org = { id: string; name: string };

/**
 * ด่านหน้า /api/v1 ทุก endpoint: IP limit → ตรวจ API key → per-org limit ตามแพ็ก
 * คืน { org } เมื่อผ่าน หรือ { response } (401/429) ให้ route ส่งกลับได้เลย
 */
export async function authenticateV1(
  req: NextRequest,
): Promise<{ org: V1Org; response?: never } | { org?: never; response: NextResponse }> {
  const ipRl = rateLimit(`api-ip:${clientIp(req)}`, API_IP_RPM);
  if (!ipRl.ok)
    return { response: rateLimited(ipRl.resetAt, `เกินลิมิต ${API_IP_RPM} คำขอ/นาที`) };

  const org = await authenticateApiKey(req.headers.get("authorization"));
  if (!org)
    return {
      response: NextResponse.json(
        { error: "unauthorized", message: "API key ไม่ถูกต้องหรือถูกยกเลิก" },
        { status: 401 },
      ),
    };

  // จำกัดอัตราตามแพ็กของร้าน (Free 120 / Pro 600 / Premium 2000 req/นาที)
  const sub = await one<Subscription>("select * from subscriptions where org_id=$1", [
    org.id,
  ]);
  const rpm = PLANS[planForOrg(sub)].limits.rpm;
  const rl = rateLimit(`api:${org.id}`, rpm);
  if (!rl.ok) return { response: rateLimited(rl.resetAt, `เกินลิมิต ${rpm} คำขอ/นาที`) };

  return { org };
}

/** อ่าน limit/offset จาก query string — limit 1..500 (default 100), offset ≥ 0 */
export function pageParams(req: NextRequest): { limit: number; offset: number } {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 100, 1), 500);
  const offset = Math.max(Number(sp.get("offset")) || 0, 0);
  return { limit, offset };
}
