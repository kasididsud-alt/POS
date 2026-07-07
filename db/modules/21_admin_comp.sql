-- Admin comp plan — ให้ผู้ดูแลระบบ (ADMIN_EMAILS) กำหนดแพ็กเกจให้ร้านได้โดยตรง
-- โดยไม่ต้องผ่าน Stripe. planForOrg() จะคืนค่า comp_plan นี้ทันทีถ้าถูกตั้งไว้
--   comp_plan = 'pro' | 'premium'  → ปลดล็อกแพ็กเกจนั้นให้ร้าน (comp/แถม)
--   comp_plan = 'free'             → บังคับให้ร้านเป็นฟรี (ระงับแพ็กเกจจ่ายเงิน)
--   comp_plan = null               → ปกติ (คิดตาม subscription จริง/trial/Stripe)
alter table subscriptions add column if not exists comp_plan text;

alter table subscriptions
  drop constraint if exists subscriptions_comp_plan_check;
alter table subscriptions
  add constraint subscriptions_comp_plan_check
  check (comp_plan is null or comp_plan in ('free', 'pro', 'premium'));
