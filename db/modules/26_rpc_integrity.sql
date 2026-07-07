-- โมดูล: RPC integrity fixes (audit P1-7, P1-8, P1-10)
-- redefine ทับของเดิม — คงพฤติกรรม hardening (โมดูล 23) + bill_no/transfer_no retry (โมดูล 25) ครบ
-- แก้ 3 บัค:
--   [P1-10] checkout_sale รับ _customer_id ข้าม org ได้ → cross-tenant debt + PII บนใบเสร็จ
--           → validate customer เป็นของ _org_id ก่อนบันทึก sales/debt/points
--   [P1-7]  receive_transfer / cancel_transfer / receive_po รันซ้ำตอน concurrent → สต็อกเบิ้ล
--           → เปลี่ยน status ให้ atomic (update ... where status=... returning) + lock แถว
--   [P1-8]  คืนบิลเครดิตไม่ลดหนี้ + ไม่ดึงแต้มคืน
--           → process_return: credit → ลด debt ตาม total_refund (ไม่ติดลบ); ดึงแต้มคืนตามสัดส่วน
-- ทุก statement idempotent (create or replace บน signature เดิม)

-- ============================================================
-- 1. checkout_sale — คง hardening + bill_no retry, เพิ่ม customer org check
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
-- 2. process_return — คง hardening (โมดูล 23) + ลดหนี้/ดึงแต้มคืนสำหรับบิลเครดิต (P1-8)
-- ============================================================
create or replace function process_return(
  _org_id uuid, _sale_id uuid, _items jsonb,
  _reason text default null, _user_id uuid default null,
  _branch_id uuid default null
)
returns uuid language plpgsql as $$
declare
  _return_id uuid; _total numeric(12,2) := 0; _item jsonb;
  _qty_text text;
  _grp record; _sold int; _sold_amt numeric(12,2); _returned int;
  _unit numeric(12,2); _name text;
  _sale record; _reduce numeric(12,2); _pts_back int;
begin
  if _items is null or jsonb_array_length(_items) = 0 then
    raise exception 'empty return';
  end if;
  if _branch_id is null then raise exception 'branch required'; end if;

  if not exists (select 1 from branches where id = _branch_id and org_id = _org_id) then
    raise exception 'สาขาไม่อยู่ในร้านนี้';
  end if;

  -- sale ต้องเป็นของ org ผู้เรียก
  select id, bill_no, payment_method, customer_id into _sale
    from sales where id = _sale_id and org_id = _org_id;
  if not found then raise exception 'ไม่พบบิลขายในร้านนี้'; end if;

  -- validate qty ทุกรายการ: จำนวนเต็ม > 0 และต้องระบุสินค้า
  for _item in select * from jsonb_array_elements(_items) loop
    _qty_text := _item->>'qty';
    if _qty_text is null or _qty_text !~ '^[0-9]+$' or _qty_text::int <= 0 then
      raise exception 'จำนวนคืนไม่ถูกต้อง (ต้องเป็นจำนวนเต็มมากกว่า 0)';
    end if;
    if (_item->>'product_id') is null or (_item->>'product_id') = '' then
      raise exception 'ต้องระบุสินค้าที่จะคืน';
    end if;
  end loop;

  -- ต่อสินค้า: (คืนสะสมก่อนหน้า + ครั้งนี้) ≤ จำนวนที่ขายจริง; ยอดคืนคิดจากราคาขายจริง
  for _grp in
    select (i->>'product_id')::uuid as product_id, sum((i->>'qty')::int) as ret_qty
      from jsonb_array_elements(_items) i
     group by 1
  loop
    select coalesce(sum(qty),0), coalesce(sum(line_total),0)
      into _sold, _sold_amt
      from sale_items
     where sale_id = _sale_id and product_id = _grp.product_id;
    if _sold = 0 then
      raise exception 'สินค้านี้ไม่อยู่ในบิลขาย';
    end if;

    select coalesce(sum(ri.qty),0) into _returned
      from sale_return_items ri
      join sale_returns r on r.id = ri.return_id
     where r.sale_id = _sale_id and ri.product_id = _grp.product_id;

    if _returned + _grp.ret_qty > _sold then
      raise exception 'คืนเกินจำนวนที่ขาย (ขาย % คืนแล้ว % ขอคืนอีก %)',
        _sold, _returned, _grp.ret_qty;
    end if;

    _unit := round(_sold_amt / _sold, 2);
    _total := _total + round(_unit * _grp.ret_qty, 2);
  end loop;

  insert into sale_returns (org_id, sale_id, total_refund, reason, created_by)
  values (_org_id, _sale_id, _total, _reason, _user_id)
  returning id into _return_id;

  for _grp in
    select (i->>'product_id')::uuid as product_id, sum((i->>'qty')::int) as ret_qty
      from jsonb_array_elements(_items) i
     group by 1
  loop
    select coalesce(sum(qty),0), coalesce(sum(line_total),0)
      into _sold, _sold_amt
      from sale_items
     where sale_id = _sale_id and product_id = _grp.product_id;
    _unit := round(_sold_amt / _sold, 2);
    select name_snapshot into _name
      from sale_items
     where sale_id = _sale_id and product_id = _grp.product_id
     limit 1;

    insert into sale_return_items (return_id, product_id, name_snapshot, unit_price, qty, line_total)
    values (_return_id, _grp.product_id, _name, _unit, _grp.ret_qty,
            round(_unit * _grp.ret_qty, 2));

    insert into stock_movements (org_id, product_id, branch_id, qty_change, reason, ref_sale_id, note, created_by)
    values (_org_id, _grp.product_id, _branch_id, _grp.ret_qty, 'return', _sale_id, 'คืนสินค้า', _user_id);
  end loop;

  -- บิลเครดิต: ลดหนี้ที่ผูกกับบิลนี้ตามยอดคืน (ไม่ให้ยอดคงเหลือติดลบ) — P1-8
  if _sale.payment_method = 'credit' and _sale.customer_id is not null then
    -- หนี้ที่ checkout_sale สร้าง note = 'ขายเชื่อ บิล ' || bill_no
    -- lock แถวก่อนปรับ กัน race กับการรับชำระ
    for _grp in
      select id, amount, paid from debts
       where org_id = _org_id and customer_id = _sale.customer_id
         and note = 'ขายเชื่อ บิล ' || _sale.bill_no
         and status = 'open'
       order by created_at
       for update
    loop
      _reduce := least(_total, _grp.amount - _grp.paid);
      exit when _reduce <= 0;
      update debts
         set amount = amount - _reduce,
             status = case when (amount - _reduce) <= paid then 'paid' else status end
       where id = _grp.id;
      _total := _total - _reduce;  -- เผื่อกระจายหลายก้อน (ปกติมีก้อนเดียว)
      exit when _total <= 0;
    end loop;
    -- reset _total กลับเพื่อคิดแต้มด้านล่าง (ใช้ยอดคืนจริง)
    _total := (select total_refund from sale_returns where id = _return_id);
  end if;

  -- ดึงแต้มคืนตามสัดส่วนที่คืน (ทุก payment method ที่มีลูกค้า) — P1-8
  if _sale.customer_id is not null then
    _pts_back := floor(_total / 100);
    if _pts_back > 0 then
      update customers
         set points = greatest(points - _pts_back, 0)
       where id = _sale.customer_id and org_id = _org_id;
    end if;
  end if;

  return _return_id;
end;
$$;

-- ============================================================
-- 3. receive_transfer / cancel_transfer — atomic status transition (P1-7)
--    ใช้ update ... where status='in_transit' returning เพื่อกันรันซ้ำตอน concurrent
-- ============================================================
create or replace function receive_transfer(_transfer_id uuid, _user_id uuid default null)
returns void language plpgsql as $$
declare _t stock_transfers%rowtype; _it record;
begin
  -- claim การเปลี่ยนสถานะแบบ atomic: ตัวที่ชนะเท่านั้นได้แถวกลับมา
  update stock_transfers
     set status = 'received', received_at = now()
   where id = _transfer_id and status = 'in_transit'
   returning * into _t;
  if not found then
    -- อาจถูก receive/cancel ไปแล้ว หรือไม่มีใบนี้
    if not exists (select 1 from stock_transfers where id = _transfer_id) then
      raise exception 'transfer not found';
    end if;
    raise exception 'transfer not in transit';
  end if;

  for _it in select * from stock_transfer_items where transfer_id = _transfer_id loop
    if _it.product_id is not null then
      insert into stock_movements (org_id, product_id, branch_id, qty_change, reason, note, created_by)
      values (_t.org_id, _it.product_id, _t.to_branch_id, _it.qty, 'transfer',
              'รับโอน ' || _t.transfer_no, _user_id);
    end if;
  end loop;
end;
$$;

create or replace function cancel_transfer(_transfer_id uuid, _user_id uuid default null)
returns void language plpgsql as $$
declare _t stock_transfers%rowtype; _it record;
begin
  update stock_transfers
     set status = 'cancelled'
   where id = _transfer_id and status = 'in_transit'
   returning * into _t;
  if not found then
    if not exists (select 1 from stock_transfers where id = _transfer_id) then
      raise exception 'transfer not found';
    end if;
    raise exception 'transfer not in transit';
  end if;

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
-- 4. receive_po — atomic status transition (P1-7)
--    เดิม check status แล้ว update แยกกัน → race รับซ้ำได้; รวมเป็น update ... returning
-- ============================================================
drop function if exists receive_po(uuid, uuid, uuid);

create or replace function receive_po(_po_id uuid, _user_id uuid default null, _branch_id uuid default null)
returns uuid language plpgsql as $$
declare _po purchase_orders%rowtype; _receipt_id uuid; _it record;
begin
  if _branch_id is null then raise exception 'branch required'; end if;

  -- claim การรับแบบ atomic: pending → received ในคำสั่งเดียว
  update purchase_orders
     set status = 'received'
   where id = _po_id and status not in ('received','cancelled')
   returning * into _po;
  if not found then
    select * into _po from purchase_orders where id = _po_id;
    if not found then raise exception 'po not found'; end if;
    if _po.status = 'received' then raise exception 'po already received'; end if;
    if _po.status = 'cancelled' then raise exception 'po cancelled'; end if;
    raise exception 'po not receivable';
  end if;

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

  return _receipt_id;
end;
$$;
