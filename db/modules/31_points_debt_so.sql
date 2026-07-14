-- โมดูล 31: สามเรื่องที่เกี่ยวพันกันรอบการขาย
--   [A] checkout_sale คืนค่า points = 0 เมื่อไม่มีลูกค้า — เดิมคำนวณแล้วส่งกลับเสมอ
--       ทำให้ UI ขึ้น "ลูกค้าได้รับ X แต้ม" ทั้งที่ไม่ได้บันทึก (บันทึกจริงมีเงื่อนไขถูกอยู่แล้ว)
--   [B] debts.sale_id — ผูกหนี้ขายเชื่อกับบิลตรงๆ แทนการอาศัย note string
--       (process_return ยังจับคู่ผ่าน note ได้ต่อ เพราะ checkout_sale เขียน note รูปแบบเดิมเสมอ)
--   [C] fulfill_sales_order — ปิด loop ขายส่ง: ส่งมอบแล้วตัดสต็อกจริงแบบ atomic
-- ทุก statement idempotent

-- ============================================================
-- [B] debts.sale_id + backfill จาก note ของบิลเดิม
-- ============================================================
alter table debts add column if not exists sale_id uuid references sales(id) on delete set null;
create index if not exists idx_debts_sale on debts(sale_id);

-- backfill เท่าที่จับคู่ได้ชัวร์: org + ลูกค้า + note ตรงรูปแบบที่ checkout_sale เขียน
-- (bill_no unique ต่อ org ตาม migration 25 — join แล้วได้บิลเดียวแน่นอน)
update debts d
   set sale_id = s.id
  from sales s
 where d.sale_id is null
   and s.org_id = d.org_id
   and d.note = 'ขายเชื่อ บิล ' || s.bill_no
   and (d.customer_id = s.customer_id or (d.customer_id is null and s.customer_id is null));

-- ============================================================
-- [A]+[B] checkout_sale — เหมือนโมดูล 26 ทุกอย่าง ต่างแค่:
--   1. insert debts ใส่ sale_id ด้วย
--   2. return points เป็น 0 เมื่อ _customer_id เป็น null (ให้ตรงกับที่บันทึกจริง)
-- ============================================================
create or replace function checkout_sale(
  _org_id uuid, _items jsonb, _payment_method text,
  _discount numeric default 0, _cash_received numeric default null,
  _cashier_id uuid default null, _customer_id uuid default null,
  _branch_id uuid default null
)
returns json language plpgsql as $$
declare
  _sale_id uuid; _bill_no text; _bill_prefix text;
  _subtotal numeric(12,2) := 0; _total numeric(12,2); _change numeric(12,2);
  _seq int; _try int; _item jsonb; _avail int; _points int;
  _qty_text text; _qty int;
  _prod record; _grp record;
begin
  if _items is null or jsonb_array_length(_items) = 0 then
    raise exception 'empty cart';
  end if;
  if _branch_id is null then raise exception 'branch required'; end if;

  -- branch ต้องเป็นของ org ผู้เรียก
  if not exists (select 1 from branches where id = _branch_id and org_id = _org_id) then
    raise exception 'สาขาไม่อยู่ในร้านนี้';
  end if;

  -- customer (ถ้าระบุ) ต้องเป็นของ org ผู้เรียก — กัน cross-tenant debt/PII (P1-10)
  if _customer_id is not null
     and not exists (select 1 from customers where id = _customer_id and org_id = _org_id) then
    raise exception 'ลูกค้าไม่อยู่ในร้านนี้';
  end if;

  if _payment_method = 'credit' and _customer_id is null then
    raise exception 'ขายเชื่อต้องระบุลูกค้า';
  end if;

  _discount := coalesce(_discount, 0);
  if _discount < 0 then raise exception 'ส่วนลดติดลบไม่ได้'; end if;

  -- validate ทุกรายการ + คิด subtotal จากราคาใน DB (ห้ามเชื่อราคาจาก client)
  for _item in select * from jsonb_array_elements(_items) loop
    _qty_text := _item->>'qty';
    if _qty_text is null or _qty_text !~ '^[0-9]+$' then
      raise exception 'จำนวนสินค้าไม่ถูกต้อง (ต้องเป็นจำนวนเต็มมากกว่า 0)';
    end if;
    _qty := _qty_text::int;
    if _qty <= 0 then
      raise exception 'จำนวนสินค้าไม่ถูกต้อง (ต้องเป็นจำนวนเต็มมากกว่า 0)';
    end if;

    select id, name, price into _prod
      from products
     where id = (_item->>'product_id')::uuid and org_id = _org_id;
    if not found then raise exception 'ไม่พบสินค้าในร้านนี้'; end if;

    _subtotal := _subtotal + _prod.price * _qty;
  end loop;

  -- กันขายเกินสต็อกรายสาขา — รวมยอดต่อสินค้า (กันสินค้าเดิมหลายบรรทัด)
  for _grp in
    select p.id, p.name, sum((i->>'qty')::int) as need
      from jsonb_array_elements(_items) i
      join products p on p.id = (i->>'product_id')::uuid
     group by p.id, p.name
  loop
    select coalesce(sum(qty_change),0) into _avail
      from stock_movements
     where product_id = _grp.id and branch_id = _branch_id;
    if _grp.need > _avail then
      raise exception 'สินค้า "%" เหลือไม่พอ (เหลือ % ต้องการ %)',
        _grp.name, _avail, _grp.need;
    end if;
  end loop;

  -- เพดานส่วนลด: ไม่เกินยอดรวม
  if _discount > _subtotal then
    raise exception 'ส่วนลด (%) เกินยอดรวม (%)', _discount, _subtotal;
  end if;

  _total := _subtotal - _discount;

  if _payment_method = 'cash' then
    _change := coalesce(_cash_received,0) - _total;
    if _change < 0 then raise exception 'cash received less than total'; end if;
  end if;

  -- ออกเลขบิล: max(seq วันนี้)+1 + retry ตอน unique_violation (สูงสุด 20 รอบ)
  _bill_prefix := to_char(now(), 'YYYYMMDD') || '-';
  for _try in 1..20 loop
    select coalesce(max((regexp_match(bill_no, '^\d{8}-(\d+)$'))[1]::int), 0) + 1
      into _seq
      from sales
     where org_id = _org_id and bill_no like _bill_prefix || '%';
    _bill_no := _bill_prefix || lpad(_seq::text, 4, '0');

    begin
      insert into sales (org_id, bill_no, subtotal, discount, total,
                         payment_method, cash_received, change_due, cashier_id, customer_id, branch_id)
      values (_org_id, _bill_no, _subtotal, _discount, _total,
              _payment_method,
              case when _payment_method='cash' then _cash_received else null end,
              _change, _cashier_id, _customer_id, _branch_id)
      returning id into _sale_id;
      exit;
    exception when unique_violation then
      if _try = 20 then
        raise exception 'ออกเลขบิลไม่สำเร็จ (ชนกันหลายครั้ง) กรุณาลองใหม่';
      end if;
    end;
  end loop;

  for _item in select * from jsonb_array_elements(_items) loop
    _qty := (_item->>'qty')::int;
    select id, name, price, cost into _prod
      from products
     where id = (_item->>'product_id')::uuid and org_id = _org_id;

    insert into sale_items (sale_id, product_id, name_snapshot, unit_price, qty, line_total, cost_snapshot)
    values (_sale_id, _prod.id, _prod.name, _prod.price, _qty, _prod.price * _qty, _prod.cost);

    insert into stock_movements (org_id, product_id, branch_id, qty_change, reason, ref_sale_id, created_by)
    values (_org_id, _prod.id, _branch_id, -1 * _qty, 'sale', _sale_id, _cashier_id);
  end loop;

  if _payment_method = 'credit' then
    -- [B] ผูกหนี้กับบิลตรงๆ ด้วย sale_id (note คงรูปแบบเดิม — process_return ยังใช้จับคู่)
    insert into debts (org_id, customer_id, amount, note, created_by, sale_id)
    values (_org_id, _customer_id, _total, 'ขายเชื่อ บิล ' || _bill_no, _cashier_id, _sale_id);
  end if;

  _points := floor(_total / 100);
  if _customer_id is not null and _points > 0 then
    update customers set points = points + _points where id = _customer_id and org_id = _org_id;
  end if;

  -- [A] points ที่รายงานต้องตรงกับที่บันทึกจริง: ไม่มีลูกค้า = 0
  return json_build_object('sale_id', _sale_id, 'bill_no', _bill_no,
                           'total', _total, 'change', _change,
                           'points', case when _customer_id is null then 0 else coalesce(_points,0) end);
end;
$$;

-- ============================================================
-- [C] fulfill_sales_order — ส่งมอบออเดอร์ขายส่ง + ตัดสต็อกจริง
--   claim สถานะแบบ atomic (update ... where status ... returning) กันกดซ้ำตัดสองรอบ
--   ของไม่พอ = raise → transaction rollback ทั้งใบ (สถานะไม่เปลี่ยน)
-- ============================================================
create or replace function fulfill_sales_order(
  _org_id uuid, _so_id uuid, _user_id uuid default null, _branch_id uuid default null
)
returns void language plpgsql as $$
declare _so sales_orders%rowtype; _grp record; _avail int;
begin
  if _branch_id is null then raise exception 'branch required'; end if;
  if not exists (select 1 from branches where id = _branch_id and org_id = _org_id) then
    raise exception 'สาขาไม่อยู่ในร้านนี้';
  end if;

  update sales_orders
     set status = 'fulfilled'
   where id = _so_id and org_id = _org_id and status in ('open','confirmed')
   returning * into _so;
  if not found then
    if not exists (select 1 from sales_orders where id = _so_id and org_id = _org_id) then
      raise exception 'ไม่พบออเดอร์ในร้านนี้';
    end if;
    raise exception 'ออเดอร์นี้ถูกส่งมอบหรือยกเลิกไปแล้ว';
  end if;

  -- เช็คของพอทุกรายการก่อนตัด (เฉพาะบรรทัดที่ผูกสินค้าในระบบ)
  for _grp in
    select i.product_id, p.name, sum(i.qty) as need
      from sales_order_items i
      join products p on p.id = i.product_id
     where i.so_id = _so_id and i.product_id is not null
     group by i.product_id, p.name
  loop
    select coalesce(sum(qty_change),0) into _avail
      from stock_movements
     where product_id = _grp.product_id and branch_id = _branch_id;
    if _grp.need > _avail then
      raise exception 'สินค้า "%" เหลือไม่พอ (เหลือ % ต้องการ %)',
        _grp.name, _avail, _grp.need;
    end if;
  end loop;

  for _grp in
    select i.product_id, sum(i.qty) as need
      from sales_order_items i
     where i.so_id = _so_id and i.product_id is not null
     group by i.product_id
  loop
    insert into stock_movements (org_id, product_id, branch_id, qty_change, reason, note, created_by)
    values (_org_id, _grp.product_id, _branch_id, -1 * _grp.need, 'sale',
            'ส่งมอบ ' || _so.so_no, _user_id);
  end loop;
end;
$$;
