-- โมดูล: ภาษีมูลค่าเพิ่ม (VAT) สำหรับออกใบกำกับภาษี
-- ราคาสินค้าเป็นแบบ "รวมภาษีแล้ว" (VAT-inclusive) ตามมาตรฐานค้าปลีกไทย
-- เมื่อร้านจด VAT จะถอด VAT ออกจากยอดรวมตอนแสดงใบกำกับภาษี
alter table organizations add column if not exists vat_registered boolean not null default false;
alter table organizations add column if not exists vat_rate numeric(5,2) not null default 7;
