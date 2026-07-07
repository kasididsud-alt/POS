-- ============================================================
-- Signup hardening: เบอร์โทร + ยอมรับเงื่อนไข (PDPA) + rate-limit ตาม IP
-- idempotent: รันซ้ำได้
-- ============================================================

-- ข้อมูลเพิ่มเติมของผู้สมัคร
alter table users add column if not exists phone text;
-- เวลาที่กดยอมรับข้อตกลง/นโยบายความเป็นส่วนตัว (เก็บไว้เป็นหลักฐาน PDPA)
alter table users add column if not exists tos_accepted_at timestamptz;

-- กันสมัครรัวจาก IP เดียว (sliding window 1 ชม.)
create table if not exists signup_attempts (
  ip text primary key,
  count int not null default 0,
  window_start timestamptz not null default now()
);
