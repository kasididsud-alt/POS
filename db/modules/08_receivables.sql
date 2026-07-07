-- โมดูล: ลูกหนี้ / เครดิต (ขายเชื่อ)
create table if not exists debts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  amount numeric(12,2) not null default 0,
  paid numeric(12,2) not null default 0,
  due_date date,
  note text,
  status text not null default 'open' check (status in ('open','paid')),
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_debts_org on debts(org_id, status);
