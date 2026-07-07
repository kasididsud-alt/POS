-- ============================================================
-- OAUTH: รองรับการล็อกอินด้วย Google (เพิ่มทีหลังจาก schema เดิม)
-- ปลอดภัยกับ DB ที่มีอยู่แล้ว — ใช้ if not exists / drop not null
-- ============================================================

-- ผู้ใช้ที่ล็อกอินด้วย Google จะไม่มีรหัสผ่าน
alter table users alter column password_hash drop not null;

-- ผูกบัญชี Google ด้วย "sub" (subject id ที่ไม่เปลี่ยน)
alter table users add column if not exists google_sub text;
alter table users add column if not exists avatar_url text;

-- 1 บัญชี Google = 1 ผู้ใช้
create unique index if not exists idx_users_google_sub on users(google_sub)
  where google_sub is not null;
