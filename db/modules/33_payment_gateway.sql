-- 33: payment gateway ของร้าน (Omise/Stripe) — ร้านเอา secret key ของบัญชีตัวเองมาผูก
-- ใช้สร้างลิงก์ชำระเงิน (บัตร/e-wallet) ส่งให้ลูกค้า เงินเข้าบัญชี gateway ของร้านตรงๆ
-- หมายเหตุ: คนละส่วนกับ Stripe ของระบบ billing แพ็กเกจ (นั่นคือบัญชีของแพลตฟอร์ม)
create table if not exists payment_gateway_settings (
  org_id uuid primary key references organizations(id) on delete cascade,
  provider text not null check (provider in ('omise', 'stripe')),
  secret_key text not null,
  updated_at timestamptz not null default now()
);
