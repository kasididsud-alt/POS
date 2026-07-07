-- โมดูล: ใบสั่งซื้อ (Purchase Orders)
create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  po_no text not null,
  status text not null default 'ordered' check (status in ('draft','ordered','received','cancelled')),
  note text,
  total numeric(12,2) not null default 0,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_po_org on purchase_orders(org_id, created_at desc);

create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  qty int not null,
  unit_cost numeric(12,2) not null,
  line_cost numeric(12,2) not null
);
create index if not exists idx_poitems_po on purchase_order_items(po_id);

-- RPC: สร้าง PO (header + items)
create or replace function create_po(
  _org_id uuid, _supplier_id uuid, _items jsonb,
  _note text default null, _user_id uuid default null
)
returns uuid language plpgsql as $$
declare
  _po_id uuid; _total numeric(12,2) := 0; _seq int; _po_no text; _item jsonb;
begin
  if _items is null or jsonb_array_length(_items) = 0 then
    raise exception 'empty po';
  end if;

  select coalesce(sum((i->>'qty')::int * (i->>'unit_cost')::numeric),0)
    into _total from jsonb_array_elements(_items) i;

  select count(*) + 1 into _seq from purchase_orders where org_id = _org_id;
  _po_no := 'PO' || to_char(now(),'YYYYMM') || '-' || lpad(_seq::text, 4, '0');

  insert into purchase_orders (org_id, supplier_id, po_no, status, note, total, created_by)
  values (_org_id, _supplier_id, _po_no, 'ordered', _note, _total, _user_id)
  returning id into _po_id;

  for _item in select * from jsonb_array_elements(_items) loop
    insert into purchase_order_items (po_id, product_id, qty, unit_cost, line_cost)
    values (_po_id, (_item->>'product_id')::uuid, (_item->>'qty')::int,
            (_item->>'unit_cost')::numeric,
            (_item->>'qty')::int * (_item->>'unit_cost')::numeric);
  end loop;

  return _po_id;
end;
$$;

-- RPC: รับเข้าตาม PO — สร้าง goods receipt + stock + อัปเดตต้นทุน + เปลี่ยนสถานะ
create or replace function receive_po(_po_id uuid, _user_id uuid default null)
returns uuid language plpgsql as $$
declare
  _po purchase_orders%rowtype; _receipt_id uuid; _it record;
begin
  select * into _po from purchase_orders where id = _po_id;
  if not found then raise exception 'po not found'; end if;
  if _po.status = 'received' then raise exception 'po already received'; end if;
  if _po.status = 'cancelled' then raise exception 'po cancelled'; end if;

  insert into goods_receipts (org_id, supplier_id, ref_no, note, total_cost, created_by)
  values (_po.org_id, _po.supplier_id, _po.po_no, 'รับตาม PO', _po.total, _user_id)
  returning id into _receipt_id;

  for _it in select * from purchase_order_items where po_id = _po_id loop
    insert into goods_receipt_items (receipt_id, product_id, qty, unit_cost, line_cost)
    values (_receipt_id, _it.product_id, _it.qty, _it.unit_cost, _it.line_cost);

    insert into stock_movements (org_id, product_id, qty_change, reason, note, created_by)
    values (_po.org_id, _it.product_id, _it.qty, 'purchase', 'รับตาม ' || _po.po_no, _user_id);

    update products set cost = _it.unit_cost
     where id = _it.product_id and org_id = _po.org_id;
  end loop;

  update purchase_orders set status = 'received' where id = _po_id;
  return _receipt_id;
end;
$$;
