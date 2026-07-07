-- โมดูล: Multi-Branch Inventory (สต็อกแยกรายสาขาจริง)
-- รันหลังสุด (21) จึง redefine ทับ view/RPC จาก schema.sql + โมดูล 06/13 ได้
-- ทุก statement idempotent (รันซ้ำได้)

-- ============================================================
-- 1a. สาขาเริ่มต้นต่อ org + memberships.branch_id
-- ============================================================
-- org ที่ยังไม่มีสาขาเลย → สร้าง "สาขาหลัก"
insert into branches (org_id, name, type, is_default)
select o.id, 'สาขาหลัก', 'shop', true
  from organizations o
 where not exists (select 1 from branches b where b.org_id = o.id);

-- org ที่มีสาขาแต่ไม่มี default → ตั้งอันเก่าสุดเป็น default
update branches b set is_default = true
 where b.id = (
   select b2.id from branches b2
    where b2.org_id = b.org_id
    order by b2.created_at asc, b2.id asc
    limit 1
 )
 and not exists (
   select 1 from branches b3 where b3.org_id = b.org_id and b3.is_default
 );

alter table memberships
  add column if not exists branch_id uuid references branches(id) on delete set null;

update memberships m
   set branch_id = (
     select b.id from branches b
      where b.org_id = m.org_id and b.is_default
      order by b.created_at asc limit 1
   )
 where m.branch_id is null;

-- ============================================================
-- 1b. stock_movements.branch_id + reason 'transfer'
-- ============================================================
alter table stock_movements
  add column if not exists branch_id uuid references branches(id) on delete restrict;

update stock_movements sm
   set branch_id = (
     select b.id from branches b
      where b.org_id = sm.org_id and b.is_default
      order by b.created_at asc limit 1
   )
 where sm.branch_id is null;

alter table stock_movements alter column branch_id set not null;

alter table stock_movements drop constraint if exists stock_movements_reason_check;
alter table stock_movements add constraint stock_movements_reason_check
  check (reason in ('purchase','sale','adjust','return','transfer'));

create index if not exists idx_stock_prod_branch_qty
  on stock_movements(product_id, branch_id, qty_change);

-- ============================================================
-- 1c. sales.branch_id (เผื่อ report รายสาขาในอนาคต)
-- ============================================================
alter table sales
  add column if not exists branch_id uuid references branches(id) on delete set null;

update sales s
   set branch_id = (
     select b.id from branches b
      where b.org_id = s.org_id and b.is_default
      order by b.created_at asc limit 1
   )
 where s.branch_id is null;

-- ============================================================
-- 1d. Redefine view product_stock (PER BRANCH)
-- ต้อง drop ก่อน เพราะเพิ่มคอลัมน์ branch_id กลางลำดับ (create or replace ไม่ให้)
-- ============================================================
drop view if exists product_stock;
create view product_stock as
  select p.id as product_id, p.org_id, m.branch_id,
         coalesce(sum(m.qty_change),0)::int as qty
  from products p
  join stock_movements m on m.product_id = p.id
  group by p.id, p.org_id, m.branch_id;

-- ============================================================
-- 1e. Redefine checkout_sale (+ _branch_id)
-- drop overload เก่า (6-arg schema.sql, 7-arg โมดูล 13) ก่อนสร้าง 8-arg
-- ============================================================
drop function if exists checkout_sale(uuid, jsonb, text, numeric, numeric, uuid);
drop function if exists checkout_sale(uuid, jsonb, text, numeric, numeric, uuid, uuid);

create or replace function checkout_sale(
  _org_id uuid, _items jsonb, _payment_method text,
  _discount numeric default 0, _cash_received numeric default null,
  _cashier_id uuid default null, _customer_id uuid default null,
  _branch_id uuid default null
)
returns json language plpgsql as $$
declare
  _sale_id uuid; _bill_no text;
  _subtotal numeric(12,2) := 0; _total numeric(12,2); _change numeric(12,2);
  _seq int; _item jsonb; _avail int; _points int;
begin
  if _items is null or jsonb_array_length(_items) = 0 then
    raise exception 'empty cart';
  end if;
  if _branch_id is null then raise exception 'branch required'; end if;

  if _payment_method = 'credit' and _customer_id is null then
    raise exception 'ขายเชื่อต้องระบุลูกค้า';
  end if;

  -- กันขายเกินสต็อก (รายสาขา)
  for _item in select * from jsonb_array_elements(_items) loop
    select coalesce(sum(qty_change),0) into _avail
      from stock_movements
     where product_id = (_item->>'product_id')::uuid and branch_id = _branch_id;
    if (_item->>'qty')::int > _avail then
      raise exception 'สินค้า "%" เหลือไม่พอ (เหลือ % ต้องการ %)',
        _item->>'name', _avail, _item->>'qty';
    end if;
  end loop;

  select coalesce(sum((i->>'unit_price')::numeric * (i->>'qty')::int), 0)
    into _subtotal from jsonb_array_elements(_items) i;

  _total := greatest(_subtotal - coalesce(_discount,0), 0);

  if _payment_method = 'cash' then
    _change := coalesce(_cash_received,0) - _total;
    if _change < 0 then raise exception 'cash received less than total'; end if;
  end if;

  select count(*) + 1 into _seq from sales
  where org_id = _org_id and created_at::date = now()::date;
  _bill_no := to_char(now(), 'YYYYMMDD') || '-' || lpad(_seq::text, 4, '0');

  insert into sales (org_id, bill_no, subtotal, discount, total,
                     payment_method, cash_received, change_due, cashier_id, customer_id, branch_id)
  values (_org_id, _bill_no, _subtotal, coalesce(_discount,0), _total,
          _payment_method,
          case when _payment_method='cash' then _cash_received else null end,
          _change, _cashier_id, _customer_id, _branch_id)
  returning id into _sale_id;

  for _item in select * from jsonb_array_elements(_items) loop
    insert into sale_items (sale_id, product_id, name_snapshot, unit_price, qty, line_total, cost_snapshot)
    values (_sale_id, (_item->>'product_id')::uuid, _item->>'name',
            (_item->>'unit_price')::numeric, (_item->>'qty')::int,
            (_item->>'unit_price')::numeric * (_item->>'qty')::int,
            coalesce((select cost from products where id = (_item->>'product_id')::uuid), 0));
    insert into stock_movements (org_id, product_id, branch_id, qty_change, reason, ref_sale_id, created_by)
    values (_org_id, (_item->>'product_id')::uuid, _branch_id, -1 * (_item->>'qty')::int, 'sale', _sale_id, _cashier_id);
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
-- 1e2. receive_goods (+ _branch_id) — รับเข้า ต่อสาขา
-- ============================================================
drop function if exists receive_goods(uuid, uuid, jsonb, text, text, uuid);

create or replace function receive_goods(
  _org_id uuid, _supplier_id uuid, _items jsonb,
  _ref_no text default null, _note text default null, _user_id uuid default null,
  _branch_id uuid default null
)
returns uuid language plpgsql as $$
declare
  _receipt_id uuid; _total numeric(12,2) := 0; _item jsonb;
  _qty int; _cost numeric(12,2);
begin
  if _items is null or jsonb_array_length(_items) = 0 then
    raise exception 'empty receipt';
  end if;
  if _branch_id is null then raise exception 'branch required'; end if;

  select coalesce(sum((i->>'qty')::int * (i->>'unit_cost')::numeric),0)
    into _total from jsonb_array_elements(_items) i;

  insert into goods_receipts (org_id, supplier_id, ref_no, note, total_cost, created_by)
  values (_org_id, _supplier_id, _ref_no, _note, _total, _user_id)
  returning id into _receipt_id;

  for _item in select * from jsonb_array_elements(_items) loop
    _qty := (_item->>'qty')::int;
    _cost := (_item->>'unit_cost')::numeric;

    insert into goods_receipt_items (receipt_id, product_id, qty, unit_cost, line_cost)
    values (_receipt_id, (_item->>'product_id')::uuid, _qty, _cost, _qty * _cost);

    insert into stock_movements (org_id, product_id, branch_id, qty_change, reason, note, created_by)
    values (_org_id, (_item->>'product_id')::uuid, _branch_id, _qty, 'purchase',
            coalesce('รับเข้า ' || _ref_no, 'รับเข้า'), _user_id);

    update products set cost = _cost
     where id = (_item->>'product_id')::uuid and org_id = _org_id;
  end loop;

  return _receipt_id;
end;
$$;

-- ============================================================
-- 1e3. receive_po (+ _branch_id) — รับเข้าตาม PO ต่อสาขา
-- ============================================================
drop function if exists receive_po(uuid, uuid);

create or replace function receive_po(_po_id uuid, _user_id uuid default null, _branch_id uuid default null)
returns uuid language plpgsql as $$
declare
  _po purchase_orders%rowtype; _receipt_id uuid; _it record;
begin
  select * into _po from purchase_orders where id = _po_id;
  if not found then raise exception 'po not found'; end if;
  if _po.status = 'received' then raise exception 'po already received'; end if;
  if _po.status = 'cancelled' then raise exception 'po cancelled'; end if;
  if _branch_id is null then raise exception 'branch required'; end if;

  insert into goods_receipts (org_id, supplier_id, ref_no, note, total_cost, created_by)
  values (_po.org_id, _po.supplier_id, _po.po_no, 'รับตาม PO', _po.total, _user_id)
  returning id into _receipt_id;

  for _it in select * from purchase_order_items where po_id = _po_id loop
    insert into goods_receipt_items (receipt_id, product_id, qty, unit_cost, line_cost)
    values (_receipt_id, _it.product_id, _it.qty, _it.unit_cost, _it.line_cost);

    insert into stock_movements (org_id, product_id, branch_id, qty_change, reason, note, created_by)
    values (_po.org_id, _it.product_id, _branch_id, _it.qty, 'purchase', 'รับตาม ' || _po.po_no, _user_id);

    update products set cost = _it.unit_cost
     where id = _it.product_id and org_id = _po.org_id;
  end loop;

  update purchase_orders set status = 'received' where id = _po_id;
  return _receipt_id;
end;
$$;

-- ============================================================
-- 1e4. process_return (+ _branch_id) — คืนของกลับเข้าสาขา
-- ============================================================
drop function if exists process_return(uuid, uuid, jsonb, text, uuid);

create or replace function process_return(
  _org_id uuid, _sale_id uuid, _items jsonb,
  _reason text default null, _user_id uuid default null,
  _branch_id uuid default null
)
returns uuid language plpgsql as $$
declare
  _return_id uuid; _total numeric(12,2) := 0; _item jsonb;
begin
  if _items is null or jsonb_array_length(_items) = 0 then
    raise exception 'empty return';
  end if;
  if _branch_id is null then raise exception 'branch required'; end if;

  select coalesce(sum((i->>'unit_price')::numeric * (i->>'qty')::int),0)
    into _total from jsonb_array_elements(_items) i;

  insert into sale_returns (org_id, sale_id, total_refund, reason, created_by)
  values (_org_id, _sale_id, _total, _reason, _user_id)
  returning id into _return_id;

  for _item in select * from jsonb_array_elements(_items) loop
    insert into sale_return_items (return_id, product_id, name_snapshot, unit_price, qty, line_total)
    values (_return_id, (_item->>'product_id')::uuid, _item->>'name',
            (_item->>'unit_price')::numeric, (_item->>'qty')::int,
            (_item->>'unit_price')::numeric * (_item->>'qty')::int);

    if (_item->>'product_id') is not null and (_item->>'product_id') <> '' then
      insert into stock_movements (org_id, product_id, branch_id, qty_change, reason, ref_sale_id, note, created_by)
      values (_org_id, (_item->>'product_id')::uuid, _branch_id, (_item->>'qty')::int, 'return', _sale_id, 'คืนสินค้า', _user_id);
    end if;
  end loop;

  return _return_id;
end;
$$;

-- ============================================================
-- 1f. Redefine create_transfer (ย้ายสต็อกจริง) + receive/cancel
-- create: ตัดสต็อกต้นทางทันที (ของอยู่บนรถ) พร้อมกันโอนเกิน
-- ============================================================
create or replace function create_transfer(
  _org_id uuid, _from uuid, _to uuid, _items jsonb,
  _note text default null, _user_id uuid default null
)
returns uuid language plpgsql as $$
declare _tid uuid; _seq int; _tno text; _item jsonb; _avail int;
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

  select count(*) + 1 into _seq from stock_transfers where org_id = _org_id;
  _tno := 'TF' || to_char(now(),'YYYYMM') || '-' || lpad(_seq::text, 4, '0');

  insert into stock_transfers (org_id, from_branch_id, to_branch_id, transfer_no, note, created_by)
  values (_org_id, _from, _to, _tno, _note, _user_id)
  returning id into _tid;

  for _item in select * from jsonb_array_elements(_items) loop
    insert into stock_transfer_items (transfer_id, product_id, name_snapshot, qty)
    values (_tid, (_item->>'product_id')::uuid, _item->>'name', (_item->>'qty')::int);

    -- ตัดออกจากต้นทางทันที
    insert into stock_movements (org_id, product_id, branch_id, qty_change, reason, note, created_by)
    values (_org_id, (_item->>'product_id')::uuid, _from, -1 * (_item->>'qty')::int, 'transfer',
            'โอนออก ' || _tno, _user_id);
  end loop;

  return _tid;
end;
$$;

-- receive: in_transit → received, เพิ่มเข้าปลายทาง
create or replace function receive_transfer(_transfer_id uuid, _user_id uuid default null)
returns void language plpgsql as $$
declare _t stock_transfers%rowtype; _it record;
begin
  select * into _t from stock_transfers where id = _transfer_id;
  if not found then raise exception 'transfer not found'; end if;
  if _t.status <> 'in_transit' then raise exception 'transfer not in transit'; end if;

  update stock_transfers set status = 'received', received_at = now() where id = _transfer_id;

  for _it in select * from stock_transfer_items where transfer_id = _transfer_id loop
    if _it.product_id is not null then
      insert into stock_movements (org_id, product_id, branch_id, qty_change, reason, note, created_by)
      values (_t.org_id, _it.product_id, _t.to_branch_id, _it.qty, 'transfer',
              'รับโอน ' || _t.transfer_no, _user_id);
    end if;
  end loop;
end;
$$;

-- cancel: in_transit → cancelled, คืนของกลับต้นทาง
create or replace function cancel_transfer(_transfer_id uuid, _user_id uuid default null)
returns void language plpgsql as $$
declare _t stock_transfers%rowtype; _it record;
begin
  select * into _t from stock_transfers where id = _transfer_id;
  if not found then raise exception 'transfer not found'; end if;
  if _t.status <> 'in_transit' then raise exception 'transfer not in transit'; end if;

  update stock_transfers set status = 'cancelled' where id = _transfer_id;

  for _it in select * from stock_transfer_items where transfer_id = _transfer_id loop
    if _it.product_id is not null then
      insert into stock_movements (org_id, product_id, branch_id, qty_change, reason, note, created_by)
      values (_t.org_id, _it.product_id, _t.from_branch_id, _it.qty, 'transfer',
              'ยกเลิกโอน ' || _t.transfer_no, _user_id);
    end if;
  end loop;
end;
$$;

-- ============================================================
-- 1g. Redefine create_organization — สร้างสาขาหลัก + ผูก owner
-- ============================================================
create or replace function create_organization(_user_id uuid, _name text, _promptpay text default null)
returns uuid language plpgsql as $$
declare _org_id uuid; _branch_id uuid;
begin
  insert into organizations (name, promptpay_id) values (_name, _promptpay)
  returning id into _org_id;

  insert into branches (org_id, name, type, is_default)
  values (_org_id, 'สาขาหลัก', 'shop', true)
  returning id into _branch_id;

  insert into memberships (org_id, user_id, role, branch_id)
  values (_org_id, _user_id, 'owner', _branch_id);

  insert into subscriptions (org_id, status, trial_ends_at)
  values (_org_id, 'trialing', now() + interval '14 days');

  return _org_id;
end;
$$;
