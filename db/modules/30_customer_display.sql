-- 30: จอลูกค้า (customer display) — อุปกรณ์อีกเครื่อง (แท็บเล็ต/จอสอง) แสดงตะกร้า/QR ให้ลูกค้า
-- จับคู่กับเครื่องแคชเชียร์ด้วยรหัส 6 หลัก แล้ว sync สถานะล่าสุดผ่านแถวนี้ (ฝั่งจอ poll อ่าน)
create table if not exists customer_displays (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid references branches(id) on delete set null,
  pair_code text not null,
  paired boolean not null default false,
  state jsonb not null default '{"mode":"idle"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customer_displays_org
  on customer_displays(org_id, created_at desc);
