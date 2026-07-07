-- โมดูล: ลืมรหัสผ่าน (forgot/reset password)
-- - เก็บเฉพาะ "hash" ของ token (sha256) ไม่เก็บตัวจริง → DB หลุดก็ใช้ token ไม่ได้
-- - token หมดอายุ 30 นาที, ใช้ได้ครั้งเดียว (used_at), ขอใหม่ = ยกเลิกของเก่า
create table if not exists password_reset_tokens (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_prt_user on password_reset_tokens(user_id);

-- กันยิงขอรีเซ็ตรัว (rate-limit ต่ออีเมล, sliding window 15 นาที)
create table if not exists password_reset_attempts (
  email text primary key,
  count int not null default 0,
  window_start timestamptz not null default now()
);
