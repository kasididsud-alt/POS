-- โมดูล: สาขา / คลัง (รากฐาน multi-location)
create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  type text not null default 'shop' check (type in ('shop','warehouse')),
  address text,
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_branches_org on branches(org_id);
