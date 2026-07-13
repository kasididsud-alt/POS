-- ============================================================
-- StockPOS — schema สำหรับ Local PostgreSQL (built-in auth, ไม่มี Supabase/RLS)
-- idempotent: รันซ้ำได้
-- ============================================================

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ---------- updated_at helper ----------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- AUTH: users + sessions (แทน Supabase Auth)
-- ============================================================
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  -- nullable: ผู้ใช้ที่ล็อกอินด้วย Google อย่างเดียวจะไม่มีรหัสผ่าน
  password_hash text,
  full_name text,
  -- ผูกกับบัญชี Google ("sub" claim) — unique ต่อ 1 บัญชี
  google_sub text unique,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_sessions_user on sessions(user_id);

-- ============================================================
-- CORE TABLES
-- ============================================================
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  promptpay_id text,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'cashier' check (role in ('owner','manager','cashier')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index if not exists idx_memberships_user on memberships(user_id);
create index if not exists idx_memberships_org on memberships(org_id);

create table if not exists subscriptions (
  org_id uuid primary key references organizations(id) on delete cascade,
  stripe_subscription_id text,
  status text not null default 'trialing',
  price_id text,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  -- แพ็กเกจที่ผู้ดูแลระบบ comp ให้ (override subscription จริง) — ดู db/modules/21_admin_comp.sql
  comp_plan text check (comp_plan is null or comp_plan in ('free', 'pro', 'premium')),
  updated_at timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_categories_org on categories(org_id);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  sku text,
  barcode text,
  name text not null,
  price numeric(12,2) not null default 0,
  cost numeric(12,2) not null default 0,
  unit text not null default 'ชิ้น',
  image_url text,
  low_stock_threshold int not null default 5,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_products_org on products(org_id);
create index if not exists idx_products_barcode on products(org_id, barcode);
-- partial index สำหรับสินค้าที่ยัง active — เร่ง query ที่กรอง is_active
-- (นับแจ้งเตือนบน layout ยิงทุกหน้า จึงคุ้มที่จะมี)
create index if not exists idx_products_org_active on products(org_id) where is_active;

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  qty_change int not null,
  reason text not null check (reason in ('purchase','sale','adjust','return')),
  ref_sale_id uuid,
  note text,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_stock_org on stock_movements(org_id);
create index if not exists idx_stock_product on stock_movements(product_id);
-- covering index: ให้ view product_stock รวม sum(qty_change) แบบ index-only ได้
-- (สำคัญเมื่อ movement เยอะระดับองค์กร — ใช้ในการนับแจ้งเตือน/หน้าคงคลัง)
create index if not exists idx_stock_product_qty on stock_movements(product_id, qty_change);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  bill_no text not null,
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  payment_method text not null check (payment_method in ('cash','promptpay')),
  cash_received numeric(12,2),
  change_due numeric(12,2),
  cashier_id uuid references users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_sales_org on sales(org_id, created_at desc);

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name_snapshot text not null,
  unit_price numeric(12,2) not null,
  qty int not null,
  line_total numeric(12,2) not null
);
create index if not exists idx_saleitems_sale on sale_items(sale_id);

-- updated_at triggers (drop+create เพื่อ idempotent)
drop trigger if exists trg_org_updated on organizations;
create trigger trg_org_updated before update on organizations
  for each row execute function set_updated_at();
drop trigger if exists trg_prod_updated on products;
create trigger trg_prod_updated before update on products
  for each row execute function set_updated_at();

-- ============================================================
-- VIEW: คงคลังปัจจุบัน
-- (drop ก่อน create — โมดูล 21 เปลี่ยน view นี้เป็นแบบรายสาขา 4 คอลัมน์
--  ถ้าใช้ create-or-replace การรัน migrate ซ้ำจะ error เพราะเปลี่ยนจำนวนคอลัมน์ไม่ได้)
-- ============================================================
drop view if exists product_stock;
create view product_stock as
  select p.id as product_id, p.org_id,
         coalesce(sum(m.qty_change), 0)::int as qty
  from products p
  left join stock_movements m on m.product_id = p.id
  group by p.id, p.org_id;

-- ============================================================
-- RPC: สร้างร้าน + owner + trial 14 วัน
-- ============================================================
create or replace function create_organization(_user_id uuid, _name text, _promptpay text default null)
returns uuid language plpgsql as $$
declare _org_id uuid;
begin
  insert into organizations (name, promptpay_id) values (_name, _promptpay)
  returning id into _org_id;
  insert into memberships (org_id, user_id, role) values (_org_id, _user_id, 'owner');
  insert into subscriptions (org_id, status, trial_ends_at)
  values (_org_id, 'trialing', now() + interval '14 days');
  return _org_id;
end;
$$;

-- ============================================================
-- RPC: จบบิล (atomic) — บันทึก sale + items + ตัดสต็อก
-- ============================================================
create or replace function checkout_sale(
  _org_id uuid, _items jsonb, _payment_method text,
  _discount numeric default 0, _cash_received numeric default null,
  _cashier_id uuid default null
)
returns json language plpgsql as $$
declare
  _sale_id uuid; _bill_no text;
  _subtotal numeric(12,2) := 0; _total numeric(12,2); _change numeric(12,2);
  _seq int; _item jsonb; _avail int;
begin
  if _items is null or jsonb_array_length(_items) = 0 then
    raise exception 'empty cart';
  end if;

  -- กันขายเกินสต็อก: เช็คคงเหลือทุกรายการก่อนตัด
  for _item in select * from jsonb_array_elements(_items) loop
    select coalesce(sum(qty_change),0) into _avail
      from stock_movements where product_id = (_item->>'product_id')::uuid;
    if (_item->>'qty')::int > _avail then
      raise exception 'สินค้า "%" เหลือไม่พอ (เหลือ % ต้องการ %)',
        _item->>'name', _avail, _item->>'qty';
    end if;
  end loop;

  select coalesce(sum((i->>'unit_price')::numeric * (i->>'qty')::int), 0)
    into _subtotal from jsonb_array_elements(_items) i;

  _total := greatest(_subtotal - coalesce(_discount,0), 0);

  if _payment_method = 'cash' then
    _change := coalesce(_cash_received,0) - _total;
    if _change < 0 then raise exception 'cash received less than total'; end if;
  end if;

  select count(*) + 1 into _seq from sales
  where org_id = _org_id and created_at::date = now()::date;
  _bill_no := to_char(now(), 'YYYYMMDD') || '-' || lpad(_seq::text, 4, '0');

  insert into sales (org_id, bill_no, subtotal, discount, total,
                     payment_method, cash_received, change_due, cashier_id)
  values (_org_id, _bill_no, _subtotal, coalesce(_discount,0), _total,
          _payment_method, _cash_received, _change, _cashier_id)
  returning id into _sale_id;

  for _item in select * from jsonb_array_elements(_items) loop
    insert into sale_items (sale_id, product_id, name_snapshot, unit_price, qty, line_total, cost_snapshot)
    values (_sale_id, (_item->>'product_id')::uuid, _item->>'name',
            (_item->>'unit_price')::numeric, (_item->>'qty')::int,
            (_item->>'unit_price')::numeric * (_item->>'qty')::int,
            coalesce((select cost from products where id = (_item->>'product_id')::uuid), 0));
    insert into stock_movements (org_id, product_id, qty_change, reason, ref_sale_id, created_by)
    values (_org_id, (_item->>'product_id')::uuid, -1 * (_item->>'qty')::int, 'sale', _sale_id, _cashier_id);
  end loop;

  return json_build_object('sale_id', _sale_id, 'bill_no', _bill_no,
                           'total', _total, 'change', _change);
end;
$$;
