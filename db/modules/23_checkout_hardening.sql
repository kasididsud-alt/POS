-- โมดูล: Hardening checkout_sale / process_return (ROADMAP Phase 1)
-- รันหลังโมดูล 21 (redefine ทับ 8-arg checkout_sale / 6-arg process_return)
-- หลักการ:
--   * ราคาต่อชิ้นอ่านจากตาราง products ฝั่ง DB เท่านั้น — ห้ามเชื่อราคาจาก client
--     (_items รับแค่ product_id + qty; field อื่นที่ client แถมมาถูกเมิน)
--   * validate qty เป็นจำนวนเต็ม > 0, product/branch ต้องเป็นของ org ผู้เรียก
--   * ส่วนลดเป็น field แยกต่อบิล: 0 ≤ discount ≤ subtotal
--   * process_return: sale ต้องเป็นของ org, ยอดคืนสะสมต่อสินค้า ≤ จำนวนที่ขายจริง
--     ราคาคืนคิดจากราคาขายจริงใน sale_items (ไม่ใช่ราคาจาก client)
-- ทุก statement idempotent (create or replace บน signature เดิม)

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

  -- validate ทุกรายการ + คิด subtotal จากราคาใน DB
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

  select count(*) + 1 into _seq from sales
  where org_id = _org_id and created_at::date = now()::date;
  _bill_no := to_char(now(), 'YYYYMMDD') || '-' || lpad(_seq::text, 4, '0');

  insert into sales (org_id, bill_no, subtotal, discount, total,
                     payment_method, cash_received, change_due, cashier_id, customer_id, branch_id)
  values (_org_id, _bill_no, _subtotal, _discount, _total,
          _payment_method,
          case when _payment_method='cash' then _cash_received else null end,
          _change, _cashier_id, _customer_id, _branch_id)
  returning id into _sale_id;

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
begin
  if _items is null or jsonb_array_length(_items) = 0 then
    raise exception 'empty return';
  end if;
  if _branch_id is null then raise exception 'branch required'; end if;

  if not exists (select 1 from branches where id = _branch_id and org_id = _org_id) then
    raise exception 'สาขาไม่อยู่ในร้านนี้';
  end if;

  -- sale ต้องเป็นของ org ผู้เรียก
  if not exists (select 1 from sales where id = _sale_id and org_id = _org_id) then
    raise exception 'ไม่พบบิลขายในร้านนี้';
  end if;

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

  -- ต่อสินค้า: (คืนสะสมก่อนหน้า + ครั้งนี้) ≤ จำนวนที่ขายจริงในบิล
  -- และคิดยอดคืนจากราคาขายจริง (sale_items) ไม่ใช่ราคาจาก client
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

  return _return_id;
end;
$$;
