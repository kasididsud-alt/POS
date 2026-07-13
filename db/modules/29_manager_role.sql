-- 29: เพิ่มบทบาท "ผู้จัดการ" (manager) — ลำดับสิทธิ์ cashier < manager < owner
-- ผู้จัดการ: จัดการสินค้า/สต็อก/จัดซื้อ/โปรโมชั่นได้ แต่เข้าเรื่องเงิน-กำไร-ภาษี-ทีมงาน-ตั้งค่าไม่ได้
-- (ตัวบังคับสิทธิ์อยู่ฝั่งแอป: MIN_ROLE_FOR_PATH ใน components/nav.ts + assertRoleAtLeast ใน lib/limits.ts
--  ชั้น DB แค่ยอมรับค่า role ใหม่ใน check constraint)

alter table memberships drop constraint if exists memberships_role_check;
alter table memberships add constraint memberships_role_check
  check (role in ('owner', 'manager', 'cashier'));
