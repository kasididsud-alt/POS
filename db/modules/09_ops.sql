-- โมดูล: เปิด-ปิดกะ, Lot/หมดอายุ, ตำแหน่งจัดเก็บ

-- กะแคชเชียร์
create table if not exists cash_shifts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  opened_by uuid references users(id),
  opening_cash numeric(12,2) not null default 0,
  closing_cash numeric(12,2),
  expected_cash numeric(12,2),
  status text not null default 'open' check (status in ('open','closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists idx_shifts_org on cash_shifts(org_id, status);

-- Lot / วันหมดอายุ
create table if not exists product_lots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  lot_no text,
  expiry_date date,
  qty int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_lots_org on product_lots(org_id, expiry_date);

-- ตำแหน่งจัดเก็บ (bin/zone)
create table if not exists storage_locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid references branches(id) on delete set null,
  code text not null,
  zone text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_locations_org on storage_locations(org_id);
