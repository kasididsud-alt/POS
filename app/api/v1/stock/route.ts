import { type NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authenticateV1, pageParams } from "../_lib";

// GET /api/v1/stock — สต็อกแยกตามสาขา (ยืนยันด้วย API key)
// Header: Authorization: Bearer kds_live_xxx
// Query: branch_id (กรองสาขา) · low_stock=true (เฉพาะที่ถึงจุดเตือน) · limit/offset
export async function GET(req: NextRequest) {
  const auth = await authenticateV1(req);
  if (auth.response) return auth.response;
  const org = auth.org;

  const { limit, offset } = pageParams(req);
  const sp = req.nextUrl.searchParams;
  const branchId = (sp.get("branch_id") ?? "").trim() || null;
  const lowOnly = sp.get("low_stock") === "true";

  const rows = await query<{
    product_id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    unit: string;
    low_stock_threshold: number;
    branch_id: string;
    branch_name: string;
    qty: number;
  }>(
    `select p.id as product_id, p.name, p.sku, p.barcode, p.unit, p.low_stock_threshold,
            b.id as branch_id, b.name as branch_name,
            coalesce(sum(sm.qty_change) filter (where sm.branch_id = b.id), 0)::int as qty
       from products p
       cross join branches b
       left join stock_movements sm on sm.product_id = p.id
      where p.org_id = $1 and p.is_active = true
        and b.org_id = $1
        and ($4::uuid is null or b.id = $4)
      group by p.id, b.id
      ${lowOnly ? "having coalesce(sum(sm.qty_change) filter (where sm.branch_id = b.id), 0) <= p.low_stock_threshold" : ""}
      order by b.name, p.name
      limit $2 offset $3`,
    [org.id, limit, offset, branchId],
  );

  return NextResponse.json({
    org: { id: org.id, name: org.name },
    count: rows.length,
    next_offset: rows.length === limit ? offset + rows.length : null,
    stock: rows,
  });
}
