import { type NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";
import { query, one } from "@/lib/db";
import { planForOrg, PLANS } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import type { Subscription } from "@/lib/types";

// เพดานคำขอต่อ IP/นาที ที่บังคับ "ก่อน" ยืนยันตัวตน — backstop สำหรับ request ที่
// key ผิด/ไม่มี key (401) ซึ่งไม่มี org ให้ผูก per-key limit ได้ กัน DB โดน flood
// ตั้งไว้ ≥ เพดานแพ็กสูงสุด (Premium) เพื่อไม่รบกวน client ที่ยิงถี่ด้วย key ถูกต้อง
const API_IP_RPM = 2000;

// req.ip / req.geo ถูกถอดออกตั้งแต่ Next v15 → ดึง IP จาก header ของ reverse proxy
// (ค่านี้ spoof ได้ ถ้าไม่มี proxy ที่ตั้ง x-forwarded-for ให้น่าเชื่อถือ ควรใช้ IP ระดับ platform)
function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function rateLimited(rpm: number, resetAt: number, msg: string): NextResponse {
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

// GET /api/v1/products — รายการสินค้า + สต็อกรวมทุกสาขา (ยืนยันด้วย API key)
// Header: Authorization: Bearer kds_live_xxx
export async function GET(req: NextRequest) {
  // ชั้นแรก: จำกัดตาม IP ก่อน authenticate — throttle traffic ที่ key ผิด/ไม่มี key
  // ไม่ให้ยิง DB lookup (api_keys/organizations) แบบไม่มีเพดาน
  const ipRl = rateLimit(`api-ip:${clientIp(req)}`, API_IP_RPM);
  if (!ipRl.ok) {
    return rateLimited(API_IP_RPM, ipRl.resetAt, `เกินลิมิต ${API_IP_RPM} คำขอ/นาที`);
  }

  const org = await authenticateApiKey(req.headers.get("authorization"));
  if (!org) {
    return NextResponse.json(
      { error: "unauthorized", message: "API key ไม่ถูกต้องหรือถูกยกเลิก" },
      { status: 401 },
    );
  }

  // จำกัดอัตราตามแพ็กของร้าน (Free 120 / Pro 600 / Premium 2000 req/นาที)
  const sub = await one<Subscription>(
    "select * from subscriptions where org_id=$1",
    [org.id],
  );
  const rpm = PLANS[planForOrg(sub)].limits.rpm;
  const rl = rateLimit(`api:${org.id}`, rpm);
  if (!rl.ok) {
    return rateLimited(rpm, rl.resetAt, `เกินลิมิต ${rpm} คำขอ/นาที`);
  }

  const products = await query<{
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    price: string;
    cost: string;
    unit: string;
    qty: number;
  }>(
    `select p.id, p.name, p.sku, p.barcode, p.price, p.cost, p.unit,
            coalesce(sum(sm.qty_change),0)::int as qty
       from products p
       left join stock_movements sm on sm.product_id = p.id
      where p.org_id = $1 and p.is_active = true
      group by p.id
      order by p.name`,
    [org.id],
  );

  return NextResponse.json({
    org: { id: org.id, name: org.name },
    count: products.length,
    products: products.map((p) => ({
      ...p,
      price: Number(p.price),
      cost: Number(p.cost),
    })),
  });
}
