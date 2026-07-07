-- โมดูล: ลูกค้า (CRM)
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  note text,
  points int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_customers_org on customers(org_id);
create index if not exists idx_customers_phone on customers(org_id, phone);

drop trigger if exists trg_customer_updated on customers;
create trigger trg_customer_updated before update on customers
  for each row execute function set_updated_at();

-- ผูกการขายกับลูกค้า (ไม่บังคับ)
alter table sales add column if not exists customer_id uuid references customers(id) on delete set null;
create index if not exists idx_sales_customer on sales(customer_id);
