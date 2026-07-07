-- โมดูล: โอนย้ายคลัง/สาขา (logistics tracking)
create table if not exists stock_transfers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  from_branch_id uuid references branches(id) on delete set null,
  to_branch_id uuid references branches(id) on delete set null,
  transfer_no text not null,
  status text not null default 'in_transit' check (status in ('in_transit','received','cancelled')),
  note text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  received_at timestamptz
);
create index if not exists idx_transfers_org on stock_transfers(org_id, created_at desc);

create table if not exists stock_transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references stock_transfers(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name_snapshot text not null,
  qty int not null
);
create index if not exists idx_transferitems_t on stock_transfer_items(transfer_id);

-- RPC: สร้างใบโอน
create or replace function create_transfer(
  _org_id uuid, _from uuid, _to uuid, _items jsonb,
  _note text default null, _user_id uuid default null
)
returns uuid language plpgsql as $$
declare _tid uuid; _seq int; _tno text; _item jsonb;
begin
  if _from = _to then raise exception 'from and to must differ'; end if;
  if _items is null or jsonb_array_length(_items) = 0 then
    raise exception 'empty transfer';
  end if;

  select count(*) + 1 into _seq from stock_transfers where org_id = _org_id;
  _tno := 'TF' || to_char(now(),'YYYYMM') || '-' || lpad(_seq::text, 4, '0');

  insert into stock_transfers (org_id, from_branch_id, to_branch_id, transfer_no, note, created_by)
  values (_org_id, _from, _to, _tno, _note, _user_id)
  returning id into _tid;

  for _item in select * from jsonb_array_elements(_items) loop
    insert into stock_transfer_items (transfer_id, product_id, name_snapshot, qty)
    values (_tid, (_item->>'product_id')::uuid, _item->>'name', (_item->>'qty')::int);
  end loop;

  return _tid;
end;
$$;
