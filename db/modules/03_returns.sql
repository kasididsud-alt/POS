-- โมดูล: คืนสินค้า / คืนเงิน
create table if not exists sale_returns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  sale_id uuid references sales(id) on delete set null,
  total_refund numeric(12,2) not null default 0,
  reason text,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_returns_org on sale_returns(org_id, created_at desc);

create table if not exists sale_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references sale_returns(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name_snapshot text not null,
  unit_price numeric(12,2) not null,
  qty int not null,
  line_total numeric(12,2) not null
);
create index if not exists idx_returnitems_return on sale_return_items(return_id);

-- RPC: คืนสินค้า (atomic) — header + items + คืนสต็อก (reason 'return', +qty)
-- _items: jsonb [{ product_id, name, unit_price, qty }]
create or replace function process_return(
  _org_id uuid, _sale_id uuid, _items jsonb,
  _reason text default null, _user_id uuid default null
)
returns uuid language plpgsql as $$
declare
  _return_id uuid; _total numeric(12,2) := 0; _item jsonb;
begin
  if _items is null or jsonb_array_length(_items) = 0 then
    raise exception 'empty return';
  end if;

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

    -- คืนของกลับเข้าสต็อก (เฉพาะที่มี product_id)
    if (_item->>'product_id') is not null and (_item->>'product_id') <> '' then
      insert into stock_movements (org_id, product_id, qty_change, reason, ref_sale_id, note, created_by)
      values (_org_id, (_item->>'product_id')::uuid, (_item->>'qty')::int, 'return', _sale_id, 'คืนสินค้า', _user_id);
    end if;
  end loop;

  return _return_id;
end;
$$;
