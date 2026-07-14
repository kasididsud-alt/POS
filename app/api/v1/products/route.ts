import { type NextRequest, NextResponse } from "next/server";
import { query, one } from "@/lib/db";
import { authenticateV1, pageParams } from "../_lib";

// GET /api/v1/products — รายการสินค้า + สต็อกรวมทุกสาขา (ยืนยันด้วย API key)
// Header: Authorization: Bearer kds_live_xxx
// Query: limit (1-500, default 100) · offset · q (ค้นหาชื่อ/sku/บาร์โค้ด)
export async function GET(req: NextRequest) {
  const auth = await authenticateV1(req);
  if (auth.response) return auth.response;
  const org = auth.org;

  const { limit, offset } = pageParams(req);
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();

  // เงื่อนไขค้นหาใช้เลข placeholder ต่างกันระหว่าง query list ($4/$5) กับ count ($2/$3)
  const listCond = q ? "and (p.name ilike $4 or p.sku ilike $4 or p.barcode = $5)" : "";
  const countCond = q ? "and (p.name ilike $2 or p.sku ilike $2 or p.barcode = $3)" : "";

  const [products, totalRow] = await Promise.all([
    query<{
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
        where p.org_id = $1 and p.is_active = true ${listCond}
        group by p.id
        order by p.name
        limit $2 offset $3`,
      q ? [org.id, limit, offset, `%${q}%`, q] : [org.id, limit, offset],
    ),
    one<{ n: number }>(
      `select count(*)::int as n from products p
        where p.org_id = $1 and p.is_active = true ${countCond}`,
      q ? [org.id, `%${q}%`, q] : [org.id],
    ),
  ]);

  const total = totalRow?.n ?? products.length;
  return NextResponse.json({
    org: { id: org.id, name: org.name },
    total,
    count: products.length,
    next_offset: offset + products.length < total ? offset + products.length : null,
    products: products.map((p) => ({
      ...p,
      price: Number(p.price),
      cost: Number(p.cost),
    })),
  });
}
