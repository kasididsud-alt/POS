-- โมดูล: โปรโมชั่น/ส่วนลด
create table if not exists promotions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  type text not null default 'percent' check (type in ('percent','amount')),
  value numeric(12,2) not null default 0,
  min_purchase numeric(12,2) not null default 0,
  starts_at date,
  ends_at date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_promotions_org on promotions(org_id);
