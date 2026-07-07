-- โมดูล: API keys สำหรับเข้าถึงข้อมูลร้านผ่าน REST API (ฟีเจอร์ Enterprise)
-- เก็บเฉพาะ hash (sha256) ของ key — ตัวจริงโชว์ครั้งเดียวตอนสร้าง
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  prefix text not null,               -- ส่วนหน้าไว้โชว์ระบุ key (เช่น kds_live_ab12)
  key_hash text not null unique,      -- sha256 ของ key เต็ม
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_api_keys_org on api_keys(org_id, created_at desc);
create index if not exists idx_api_keys_hash on api_keys(key_hash) where revoked_at is null;
