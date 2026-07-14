-- 34: SMS ของร้าน (ThaiBulkSMS/Twilio) — แจ้งสถานะออเดอร์/ข้อความถึงลูกค้าทางเบอร์มือถือ
-- เก็บ credentials ของบัญชีผู้ให้บริการที่ร้านสมัครเอง (ค่าส่งคิดกับร้านโดยตรง)
create table if not exists sms_settings (
  org_id uuid primary key references organizations(id) on delete cascade,
  provider text not null check (provider in ('thaibulksms', 'twilio')),
  api_key text not null,      -- ThaiBulkSMS: api_key / Twilio: Account SID
  api_secret text not null,   -- ThaiBulkSMS: api_secret / Twilio: Auth Token
  sender text,                -- ชื่อผู้ส่งที่ลงทะเบียนไว้ (ThaiBulkSMS) / เบอร์ From (Twilio)
  updated_at timestamptz not null default now()
);
