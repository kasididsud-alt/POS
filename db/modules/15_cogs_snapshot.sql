-- โมดูล: เก็บต้นทุน ณ เวลาขาย (COGS snapshot) เพื่อกำไรย้อนหลังที่แม่นยำ
alter table sale_items add column if not exists cost_snapshot numeric(12,2) not null default 0;

-- backfill แถวเก่า (cost_snapshot ยังเป็น 0) ด้วยต้นทุนปัจจุบันของสินค้า — ค่าที่ดีที่สุดที่มี
update sale_items si
   set cost_snapshot = p.cost
  from products p
 where p.id = si.product_id
   and si.cost_snapshot = 0
   and p.cost > 0;
