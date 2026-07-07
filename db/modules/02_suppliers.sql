-- โมดูล: ซัพพลายเออร์ + รับสินค้าเข้า (Goods Receipt)
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_suppliers_org on suppliers(org_id);

drop trigger if exists trg_supplier_updated on suppliers;
create trigger trg_supplier_updated before update on suppliers
  for each row execute function set_updated_at();

create table if not exists goods_receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  ref_no text,
  note text,
  total_cost numeric(12,2) not null default 0,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_gr_org on goods_receipts(org_id, created_at desc);

create table if not exists goods_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references goods_receipts(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  qty int not null,
  unit_cost numeric(12,2) not null,
  line_cost numeric(12,2) not null
);
create index if not exists idx_gritems_receipt on goods_receipt_items(receipt_id);

-- RPC: รับสินค้าเข้า (atomic) — header + items + stock_movements + อัปเดตต้นทุนสินค้า
-- _items: jsonb [{ product_id, qty, unit_cost }]
create or replace function receive_goods(
  _org_id uuid, _supplier_id uuid, _items jsonb,
  _ref_no text default null, _note text default null, _user_id uuid default null
)
returns uuid language plpgsql as $$
declare
  _receipt_id uuid; _total numeric(12,2) := 0; _item jsonb;
  _qty int; _cost numeric(12,2);
begin
  if _items is null or jsonb_array_length(_items) = 0 then
    raise exception 'empty receipt';
  end if;

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

    insert into stock_movements (org_id, product_id, qty_change, reason, note, created_by)
    values (_org_id, (_item->>'product_id')::uuid, _qty, 'purchase',
            coalesce('รับเข้า ' || _ref_no, 'รับเข้า'), _user_id);

    -- อัปเดตต้นทุนล่าสุดของสินค้า
    update products set cost = _cost
     where id = (_item->>'product_id')::uuid and org_id = _org_id;
  end loop;

  return _receipt_id;
end;
$$;
