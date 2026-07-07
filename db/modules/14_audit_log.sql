-- โมดูล: บันทึกการกระทำสำคัญ (audit log)
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_org on audit_logs(org_id, created_at desc);
