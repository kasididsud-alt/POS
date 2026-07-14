-- 35: ข้อความติดต่อทีมงาน (support) — ร้านส่งคำถาม/แจ้งปัญหา/ขอเปิด integration จากในแอป
-- เก็บลง DB เสมอ (อีเมลแจ้งแอดมินเป็น best-effort) — แอดมินดูได้ที่ /admin
create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  topic text not null,
  message text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists idx_contact_messages_open
  on contact_messages(created_at desc) where resolved_at is null;
