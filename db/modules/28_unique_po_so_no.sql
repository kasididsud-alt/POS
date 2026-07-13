-- โมดูล: เลขใบสั่งซื้อ (po_no) / เลขออเดอร์ขายส่ง (so_no) ห้ามซ้ำ
-- ปัญหาเดิม: create_po (โมดูล 05) และ create_sales_order (โมดูล 10) ออกเลขด้วย count(*)+1
--            → race ตอนยิงพร้อมกันได้เลขซ้ำ (แบบเดียวกับ bill_no/transfer_no ที่แก้ไปในโมดูล 25)
-- ทางแก้ (ตามแบบโมดูล 25): unique index (org_id, po_no) / (org_id, so_no)
--         + ออกเลขจาก max(seq เดือนนี้)+1 ใน retry loop จับ unique_violation (สูงสุด 20 รอบ)
--         (read committed: insert ที่ชนจะรอ tx แรก commit แล้วค่อย violate → รอบถัดไปเห็นเลขใหม่)
-- หมายเหตุ: เดิม seq นับ count ทั้ง org ตลอดกาล — ตอนนี้นับต่อเดือนตาม prefix POYYYYMM/SOYYYYMM
--           (format ที่ผู้ใช้เห็นเหมือนเดิม แนวเดียวกับ transfer_no ในโมดูล 25)
-- ทุก statement idempotent

-- ============================================================
-- 1. ข้อมูลเก่าที่ซ้ำอยู่แล้ว: เติม suffix -dupN ก่อนสร้าง unique index
--    (ไม่ลบข้อมูล — แค่ rename; รันซ้ำได้เพราะรอบถัดไปไม่มีแถว rn > 1 แล้ว)
-- ============================================================
with d as (
  select id, row_number() over (partition by org_id, po_no order by created_at, id) as rn
    from purchase_orders
)
update purchase_orders p
   set po_no = p.po_no || '-dup' || (d.rn - 1)
  from d
 where d.id = p.id and d.rn > 1;

create unique index if not exists uq_po_org_no on purchase_orders(org_id, po_no);

with d as (
  select id, row_number() over (partition by org_id, so_no order by created_at, id) as rn
    from sales_orders
)
update sales_orders s
   set so_no = s.so_no || '-dup' || (d.rn - 1)
  from d
 where d.id = s.id and d.rn > 1;

create unique index if not exists uq_so_org_no on sales_orders(org_id, so_no);

-- ============================================================
-- 2. create_po — redefine ทับโมดูล 05 (คงพฤติกรรมเดิมทั้งหมด)
--    เปลี่ยนเฉพาะการออกเลข: max(seq เดือนนี้)+1 + retry ตอน unique_violation
-- ============================================================
create or replace function create_po(
  _org_id uuid, _supplier_id uuid, _items jsonb,
  _note text default null, _user_id uuid default null
)
returns uuid language plpgsql as $$
declare
  _po_id uuid; _total numeric(12,2) := 0;
  _seq int; _try int; _po_no text; _po_prefix text; _item jsonb;
begin
  if _items is null or jsonb_array_length(_items) = 0 then
    raise exception 'empty po';
  end if;

  select coalesce(sum((i->>'qty')::int * (i->>'unit_cost')::numeric),0)
    into _total from jsonb_array_elements(_items) i;

  -- ออกเลข PO: max(seq เดือนนี้)+1 แล้ว insert; ถ้าชน unique ให้ลองใหม่ (สูงสุด 20 รอบ)
  _po_prefix := 'PO' || to_char(now(),'YYYYMM') || '-';
  for _try in 1..20 loop
    select coalesce(max((regexp_match(po_no, '^PO\d{6}-(\d+)$'))[1]::int), 0) + 1
      into _seq
      from purchase_orders
     where org_id = _org_id and po_no like _po_prefix || '%';
    _po_no := _po_prefix || lpad(_seq::text, 4, '0');

    begin
      insert into purchase_orders (org_id, supplier_id, po_no, status, note, total, created_by)
      values (_org_id, _supplier_id, _po_no, 'ordered', _note, _total, _user_id)
      returning id into _po_id;
      exit; -- สำเร็จ
    exception when unique_violation then
      if _try = 20 then
        raise exception 'ออกเลขใบสั่งซื้อไม่สำเร็จ (ชนกันหลายครั้ง) กรุณาลองใหม่';
      end if;
      -- วนใหม่ — statement ถัดไปเห็น PO ที่เพิ่ง commit แล้ว
    end;
  end loop;

  for _item in select * from jsonb_array_elements(_items) loop
    insert into purchase_order_items (po_id, product_id, qty, unit_cost, line_cost)
    values (_po_id, (_item->>'product_id')::uuid, (_item->>'qty')::int,
            (_item->>'unit_cost')::numeric,
            (_item->>'qty')::int * (_item->>'unit_cost')::numeric);
  end loop;

  return _po_id;
end;
$$;

-- ============================================================
-- 3. create_sales_order — redefine ทับโมดูล 10 (คงพฤติกรรมเดิมทั้งหมด)
--    เปลี่ยนการออกเลขแบบเดียวกับ PO
-- ============================================================
create or replace function create_sales_order(
  _org_id uuid, _customer_id uuid, _items jsonb,
  _note text default null, _user_id uuid default null
)
returns uuid language plpgsql as $$
declare
  _so_id uuid; _total numeric(12,2) := 0;
  _seq int; _try int; _so_no text; _so_prefix text; _item jsonb;
begin
  if _items is null or jsonb_array_length(_items) = 0 then
    raise exception 'empty order';
  end if;

  select coalesce(sum((i->>'unit_price')::numeric * (i->>'qty')::int),0)
    into _total from jsonb_array_elements(_items) i;

  _so_prefix := 'SO' || to_char(now(),'YYYYMM') || '-';
  for _try in 1..20 loop
    select coalesce(max((regexp_match(so_no, '^SO\d{6}-(\d+)$'))[1]::int), 0) + 1
      into _seq
      from sales_orders
     where org_id = _org_id and so_no like _so_prefix || '%';
    _so_no := _so_prefix || lpad(_seq::text, 4, '0');

    begin
      insert into sales_orders (org_id, customer_id, so_no, note, total, created_by)
      values (_org_id, _customer_id, _so_no, _note, _total, _user_id)
      returning id into _so_id;
      exit;
    exception when unique_violation then
      if _try = 20 then
        raise exception 'ออกเลขออเดอร์ไม่สำเร็จ (ชนกันหลายครั้ง) กรุณาลองใหม่';
      end if;
    end;
  end loop;

  for _item in select * from jsonb_array_elements(_items) loop
    insert into sales_order_items (so_id, product_id, name_snapshot, unit_price, qty, line_total)
    values (_so_id, (_item->>'product_id')::uuid, _item->>'name',
            (_item->>'unit_price')::numeric, (_item->>'qty')::int,
            (_item->>'unit_price')::numeric * (_item->>'qty')::int);
  end loop;

  return _so_id;
end;
$$;
