-- โมดูล: เลขบิล/เลขใบโอนห้ามซ้ำ (ROADMAP Phase 2)
-- ปัญหาเดิม: bill_no/transfer_no ออกเลขด้วย count(*)+1 → race ตอนยิงพร้อมกันได้เลขซ้ำ
-- ทางแก้: unique index (org_id, bill_no) / (org_id, transfer_no)
--         + ออกเลขจาก max(seq เดิม)+1 ใน retry loop จับ unique_violation (สูงสุด 20 รอบ)
--         (read committed: insert ที่ชนจะรอ tx แรก commit แล้วค่อย violate → รอบถัดไปเห็นเลขใหม่)
-- ทุก statement idempotent

-- ============================================================
-- 1. ข้อมูลเก่าที่ซ้ำอยู่แล้ว: เติม suffix -dupN ก่อนสร้าง unique index
--    (ไม่ลบข้อมูล — แค่ rename; รันซ้ำได้เพราะรอบถัดไปไม่มีแถว rn > 1 แล้ว)
-- ============================================================
with d as (
  select id, row_number() over (partition by org_id, bill_no order by created_at, id) as rn
    from sales
)
update sales s
   set bill_no = s.bill_no || '-dup' || (d.rn - 1)
  from d
 where d.id = s.id and d.rn > 1;

create unique index if not exists uq_sales_org_billno on sales(org_id, bill_no);

with d as (
  select id, row_number() over (partition by org_id, transfer_no order by created_at, id) as rn
    from stock_transfers
)
update stock_transfers t
   set transfer_no = t.transfer_no || '-dup' || (d.rn - 1)
  from d
 where d.id = t.id and d.rn > 1;

create unique index if not exists uq_transfers_org_no on stock_transfers(org_id, transfer_no);

-- ============================================================
-- 2. checkout_sale — redefine ทับโมดูล 23 (คง hardening ทั้งหมด)
--    เปลี่ยนเฉพาะการออกเลขบิล: max(seq)+1 + retry ตอน unique_violation
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

  -- ออกเลขบิล: max(seq วันนี้)+1 แล้ว insert; ถ้าชน unique ให้ลองใหม่ (สูงสุด 20 รอบ)
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
      exit; -- สำเร็จ
    exception when unique_violation then
      if _try = 20 then
        raise exception 'ออกเลขบิลไม่สำเร็จ (ชนกันหลายครั้ง) กรุณาลองใหม่';
      end if;
      -- วนใหม่ — statement ถัดไปเห็นบิลที่เพิ่ง commit แล้ว
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
    insert into debts (org_id, customer_id, amount, note, created_by)
    values (_org_id, _customer_id, _total, 'ขายเชื่อ บิล ' || _bill_no, _cashier_id);
  end if;

  _points := floor(_total / 100);
  if _customer_id is not null and _points > 0 then
    update customers set points = points + _points where id = _customer_id and org_id = _org_id;
  end if;

  return json_build_object('sale_id', _sale_id, 'bill_no', _bill_no,
                           'total', _total, 'change', _change, 'points', coalesce(_points,0));
end;
$$;

-- ============================================================
-- 3. create_transfer — redefine ทับโมดูล 21 (คงการกันโอนเกินสต็อกไว้)
--    เปลี่ยนการออกเลขใบโอนเป็น max(seq เดือนนี้)+1 + retry แบบเดียวกับบิล
--    (เดิมนับ count ทั้ง org ตลอดกาล — ตอนนี้ seq นับต่อเดือนตาม prefix TFYYYYMM)
-- ============================================================
create or replace function create_transfer(
  _org_id uuid, _from uuid, _to uuid, _items jsonb,
  _note text default null, _user_id uuid default null
)
returns uuid language plpgsql as $$
declare
  _tid uuid; _seq int; _try int; _tno text; _tprefix text;
  _item jsonb; _avail int;
begin
  if _from = _to then raise exception 'from and to must differ'; end if;
  if _items is null or jsonb_array_length(_items) = 0 then
    raise exception 'empty transfer';
  end if;

  -- กันโอนเกินสต็อกต้นทาง
  for _item in select * from jsonb_array_elements(_items) loop
    select coalesce(sum(qty_change),0) into _avail
      from stock_movements
     where product_id = (_item->>'product_id')::uuid and branch_id = _from;
    if (_item->>'qty')::int > _avail then
      raise exception 'สินค้า "%" ที่สาขาต้นทางเหลือไม่พอ (เหลือ % ต้องการ %)',
        _item->>'name', _avail, _item->>'qty';
    end if;
  end loop;

  _tprefix := 'TF' || to_char(now(),'YYYYMM') || '-';
  for _try in 1..20 loop
    select coalesce(max((regexp_match(transfer_no, '^TF\d{6}-(\d+)$'))[1]::int), 0) + 1
      into _seq
      from stock_transfers
     where org_id = _org_id and transfer_no like _tprefix || '%';
    _tno := _tprefix || lpad(_seq::text, 4, '0');

    begin
      insert into stock_transfers (org_id, from_branch_id, to_branch_id, transfer_no, note, created_by)
      values (_org_id, _from, _to, _tno, _note, _user_id)
      returning id into _tid;
      exit;
    exception when unique_violation then
      if _try = 20 then
        raise exception 'ออกเลขใบโอนไม่สำเร็จ (ชนกันหลายครั้ง) กรุณาลองใหม่';
      end if;
    end;
  end loop;

  for _item in select * from jsonb_array_elements(_items) loop
    insert into stock_transfer_items (transfer_id, product_id, name_snapshot, qty)
    values (_tid, (_item->>'product_id')::uuid, _item->>'name', (_item->>'qty')::int);

    -- ตัดออกจากต้นทางทันที (ของอยู่บนรถ)
    insert into stock_movements (org_id, product_id, branch_id, qty_change, reason, note, created_by)
    values (_org_id, (_item->>'product_id')::uuid, _from, -1 * (_item->>'qty')::int, 'transfer',
            'โอนออก ' || _tno, _user_id);
  end loop;

  return _tid;
end;
$$;
