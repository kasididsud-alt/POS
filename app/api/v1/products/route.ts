import { type NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";
import { query, one } from "@/lib/db";
import { planForOrg, PLANS } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import type { Subscription } from "@/lib/types";

// GET /api/v1/products — รายการสินค้า + สต็อกรวมทุกสาขา (ยืนยันด้วย API key)
// Header: Authorization: Bearer kds_live_xxx
export async function GET(req: NextRequest) {
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
    return NextResponse.json(
      { error: "rate_limited", message: `เกินลิมิต ${rpm} คำขอ/นาที` },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000)),
          ),
        },
      },
    );
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
