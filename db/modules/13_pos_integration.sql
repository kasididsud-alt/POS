-- โมดูล: เชื่อม POS เข้ากับลูกค้า/แต้ม/ขายเชื่อ
-- เพิ่มวิธีชำระ 'credit' (ขายเชื่อ)
alter table sales drop constraint if exists sales_payment_method_check;
alter table sales add constraint sales_payment_method_check
  check (payment_method in ('cash','promptpay','credit'));

-- ปรับ checkout_sale: รับ _customer_id, ผูกลูกค้า + สะสมแต้ม (1 แต้ม/100 บาท) + ขายเชื่อสร้างลูกหนี้
create or replace function checkout_sale(
  _org_id uuid, _items jsonb, _payment_method text,
  _discount numeric default 0, _cash_received numeric default null,
  _cashier_id uuid default null, _customer_id uuid default null
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

  if _payment_method = 'credit' and _customer_id is null then
    raise exception 'ขายเชื่อต้องระบุลูกค้า';
  end if;

  -- กันขายเกินสต็อก
  for _item in select * from jsonb_array_elements(_items) loop
    select coalesce(sum(qty_change),0) into _avail
      from stock_movements where product_id = (_item->>'product_id')::uuid;
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
                     payment_method, cash_received, change_due, cashier_id, customer_id)
  values (_org_id, _bill_no, _subtotal, coalesce(_discount,0), _total,
          _payment_method,
          case when _payment_method='cash' then _cash_received else null end,
          _change, _cashier_id, _customer_id)
  returning id into _sale_id;

  for _item in select * from jsonb_array_elements(_items) loop
    insert into sale_items (sale_id, product_id, name_snapshot, unit_price, qty, line_total, cost_snapshot)
    values (_sale_id, (_item->>'product_id')::uuid, _item->>'name',
            (_item->>'unit_price')::numeric, (_item->>'qty')::int,
            (_item->>'unit_price')::numeric * (_item->>'qty')::int,
            coalesce((select cost from products where id = (_item->>'product_id')::uuid), 0));
    insert into stock_movements (org_id, product_id, qty_change, reason, ref_sale_id, created_by)
    values (_org_id, (_item->>'product_id')::uuid, -1 * (_item->>'qty')::int, 'sale', _sale_id, _cashier_id);
  end loop;

  -- ขายเชื่อ → สร้างลูกหนี้
  if _payment_method = 'credit' then
    insert into debts (org_id, customer_id, amount, note, created_by)
    values (_org_id, _customer_id, _total, 'ขายเชื่อ บิล ' || _bill_no, _cashier_id);
  end if;

  -- สะสมแต้ม (1 แต้มต่อ 100 บาท) ให้ลูกค้า
  _points := floor(_total / 100);
  if _customer_id is not null and _points > 0 then
    update customers set points = points + _points where id = _customer_id and org_id = _org_id;
  end if;

  return json_build_object('sale_id', _sale_id, 'bill_no', _bill_no,
                           'total', _total, 'change', _change, 'points', coalesce(_points,0));
end;
$$;
