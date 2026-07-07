-- โมดูล: ข้อมูลร้านเพิ่มเติม (สำหรับออกใบเสร็จ/ใบกำกับภาษี)
alter table organizations add column if not exists address text;
alter table organizations add column if not exists phone text;
alter table organizations add column if not exists tax_id text;
