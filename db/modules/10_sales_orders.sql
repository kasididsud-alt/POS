-- โมดูล: ออเดอร์ขายส่ง (B2B Sales Orders / ใบเสนอราคา)
create table if not exists sales_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  so_no text not null,
  status text not null default 'open' check (status in ('open','confirmed','fulfilled','cancelled')),
  note text,
  total numeric(12,2) not null default 0,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_so_org on sales_orders(org_id, created_at desc);

create table if not exists sales_order_items (
  id uuid primary key default gen_random_uuid(),
  so_id uuid not null references sales_orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name_snapshot text not null,
  unit_price numeric(12,2) not null,
  qty int not null,
  line_total numeric(12,2) not null
);
create index if not exists idx_soitems_so on sales_order_items(so_id);

create or replace function create_sales_order(
  _org_id uuid, _customer_id uuid, _items jsonb,
  _note text default null, _user_id uuid default null
)
returns uuid language plpgsql as $$
declare _so_id uuid; _total numeric(12,2) := 0; _seq int; _so_no text; _item jsonb;
begin
  if _items is null or jsonb_array_length(_items) = 0 then
    raise exception 'empty order';
  end if;

  select coalesce(sum((i->>'unit_price')::numeric * (i->>'qty')::int),0)
    into _total from jsonb_array_elements(_items) i;

  select count(*) + 1 into _seq from sales_orders where org_id = _org_id;
  _so_no := 'SO' || to_char(now(),'YYYYMM') || '-' || lpad(_seq::text, 4, '0');

  insert into sales_orders (org_id, customer_id, so_no, note, total, created_by)
  values (_org_id, _customer_id, _so_no, _note, _total, _user_id)
  returning id into _so_id;

  for _item in select * from jsonb_array_elements(_items) loop
    insert into sales_order_items (so_id, product_id, name_snapshot, unit_price, qty, line_total)
    values (_so_id, (_item->>'product_id')::uuid, _item->>'name',
            (_item->>'unit_price')::numeric, (_item->>'qty')::int,
            (_item->>'unit_price')::numeric * (_item->>'qty')::int);
  end loop;

  return _so_id;
end;
$$;
