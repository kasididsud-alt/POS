-- 36: โลโก้ร้าน — เก็บเป็น data URL (ย่อฝั่ง client แล้ว) ใช้บนใบเสร็จ/ใบกำกับ/รายงาน
alter table organizations add column if not exists logo_url text;
