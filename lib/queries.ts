import { query } from "@/lib/db";
import type { Category, ProductWithStock } from "@/lib/types";

/**
 * ดึงสินค้าพร้อมจำนวนคงคลัง (รายสาขา) + ชื่อหมวด
 * branchId บังคับ — qty มาจากสาขานี้เท่านั้น (ต้องมี `and ps.branch_id` ใน join
 * ไม่งั้น view per-branch จะแตกเป็น 1 แถวต่อสาขา → สินค้าซ้ำ/ยอดเบิ้ล)
 */
export async function getProductsWithStock(
  orgId: string,
  branchId: string | null,
  opts: { activeOnly?: boolean } = {},
): Promise<ProductWithStock[]> {
  // เจตนาไม่ select image_url — base64 ของทุกชิ้นทำให้ list หนักมากที่สินค้าหลักพัน
  // UI ใช้ has_image แล้วโหลดรูปเป็นรายตัวผ่าน /api/products/[id]/image
  return query<ProductWithStock>(
    `select p.id, p.org_id, p.category_id, p.sku, p.barcode, p.name,
            p.price, p.cost, p.unit, p.low_stock_threshold, p.is_active,
            p.created_at, p.updated_at,
            (p.image_url is not null) as has_image,
            coalesce(ps.qty, 0) as qty,
            c.name as category_name
       from products p
       left join product_stock ps on ps.product_id = p.id and ps.branch_id = $2
       left join categories c on c.id = p.category_id
      where p.org_id = $1
        and ($3::boolean is not true or p.is_active = true)
      order by p.created_at desc`,
    [orgId, branchId, opts.activeOnly ?? false],
  );
}

/**
 * หน้ารายการสินค้า: แบ่งหน้า + ค้นหาฝั่ง DB (ชื่อ/SKU/บาร์โค้ด)
 * — ร้านที่สินค้าหลักพันไม่ต้องลากทั้งตารางมาที่เบราว์เซอร์
 * total ใช้ window function เพื่อจบใน query เดียว
 */
export async function getProductsPage(
  orgId: string,
  branchId: string | null,
  opts: { q?: string; page?: number; pageSize?: number } = {},
): Promise<{ rows: ProductWithStock[]; total: number }> {
  const pageSize = Math.min(Math.max(opts.pageSize ?? 50, 1), 200);
  const page = Math.max(opts.page ?? 1, 1);
  const q = (opts.q ?? "").trim();
  const rows = await query<ProductWithStock & { total_count: number }>(
    `select p.id, p.org_id, p.category_id, p.sku, p.barcode, p.name,
            p.price, p.cost, p.unit, p.low_stock_threshold, p.is_active,
            p.created_at, p.updated_at,
            (p.image_url is not null) as has_image,
            coalesce(ps.qty, 0) as qty,
            c.name as category_name,
            count(*) over()::int as total_count
       from products p
       left join product_stock ps on ps.product_id = p.id and ps.branch_id = $2
       left join categories c on c.id = p.category_id
      where p.org_id = $1
        and ($3 = '' or p.name ilike '%' || $3 || '%'
             or p.sku ilike '%' || $3 || '%'
             or p.barcode ilike '%' || $3 || '%')
      order by p.created_at desc
      limit $4 offset $5`,
    [orgId, branchId, q, pageSize, (page - 1) * pageSize],
  );
  const total = rows[0]?.total_count ?? 0;
  return { rows: rows.map(({ total_count: _t, ...r }) => r as ProductWithStock), total };
}

/**
 * นับจำนวนสินค้าที่ต้องแจ้งเตือน (หมด + ใกล้หมด) ของสาขาที่ระบุ ด้วย count(*) ที่ฝั่ง DB
 * — ใช้บน layout ที่ครอบทุกหน้า จึงต้องเบา ห้ามดึงทั้งตารางมานับใน JS
 * เกณฑ์: จำนวนคงคลังในสาขา <= จุดแจ้งเตือน (ครอบคลุมทั้งของหมดและใกล้หมด)
 */
export async function countStockAlerts(
  orgId: string,
  branchId: string | null,
): Promise<number> {
  const rows = await query<{ n: number }>(
    `select count(*)::int as n
       from products p
       left join product_stock ps on ps.product_id = p.id and ps.branch_id = $2
      where p.org_id = $1
        and p.is_active = true
        and coalesce(ps.qty, 0) <= p.low_stock_threshold`,
    [orgId, branchId],
  );
  return rows[0]?.n ?? 0;
}

/**
 * นับจำนวน Lot ที่ใกล้หมดอายุหรือหมดอายุแล้ว (ยังมีของค้างอยู่ qty > 0)
 * — ใช้โชว์การ์ดเตือนบนหน้าคลังสินค้า
 * เกณฑ์: มีวันหมดอายุ และ expiry_date <= วันนี้ + N วัน (ครอบคลุมที่หมดอายุไปแล้วด้วย)
 * หมายเหตุ: product_lots เป็นระดับ org (ไม่มี branch_id) จึงนับรวมทุกสาขา
 */
export async function countExpiringLots(
  orgId: string,
  withinDays = 30,
): Promise<number> {
  const rows = await query<{ n: number }>(
    `select count(*)::int as n
       from product_lots
      where org_id = $1
        and qty > 0
        and expiry_date is not null
        and expiry_date <= current_date + ($2::int * interval '1 day')`,
    [orgId, withinDays],
  );
  return rows[0]?.n ?? 0;
}

export async function getCategories(orgId: string): Promise<Category[]> {
  return query<Category>(
    "select * from categories where org_id = $1 order by name",
    [orgId],
  );
}
