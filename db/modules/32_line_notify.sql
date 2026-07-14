-- 32: แจ้งเตือนผ่าน LINE OA (Messaging API) — ร้านเอา channel token ของ LINE OA ตัวเองมาผูก
-- แล้วระบบ push แจ้งเตือน (เริ่มที่สินค้าใกล้หมดหลังขาย) เข้า LINE ของเจ้าของร้าน/กลุ่มร้าน
create table if not exists line_settings (
  org_id uuid primary key references organizations(id) on delete cascade,
  channel_token text not null,        -- channel access token ของ LINE OA (long-lived)
  recipient_id text not null,         -- userId/groupId ปลายทางที่จะ push หา
  notify_low_stock boolean not null default true,
  updated_at timestamptz not null default now()
);

-- กันสแปม: จดว่าแจ้ง "สินค้าตัวนี้ใกล้หมด" ไปเมื่อไหร่ — คูลดาวน์ก่อนแจ้งซ้ำ
create table if not exists line_alert_log (
  org_id uuid not null references organizations(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (org_id, product_id)
);
