-- ============================================================
-- StockPOS — initial schema (multi-tenant inventory + POS)
-- ============================================================

-- ---------- helper: updated_at ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- TABLES
-- ============================================================

-- profiles: 1:1 กับ auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

-- organizations: 1 ร้าน = 1 org
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  promptpay_id text,                       -- เบอร์/เลขบัตร พร้อมเพย์ของร้าน
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- memberships: ผู้ใช้ <-> ร้าน + role
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'cashier' check (role in ('owner','cashier')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index on public.memberships(user_id);
create index on public.memberships(org_id);

-- subscriptions: สถานะแพ็กเกจของร้าน (sync จาก Stripe webhook)
create table public.subscriptions (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  stripe_subscription_id text,
  status text not null default 'trialing',  -- trialing/active/past_due/canceled/incomplete
  price_id text,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  updated_at timestamptz not null default now()
);

-- categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index on public.categories(org_id);

-- products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  sku text,
  barcode text,
  name text not null,
  price numeric(12,2) not null default 0,     -- ราคาขาย
  cost numeric(12,2) not null default 0,       -- ต้นทุน
  unit text not null default 'ชิ้น',
  image_url text,
  low_stock_threshold int not null default 5,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.products(org_id);
create index on public.products(org_id, barcode);

-- stock_movements: ledger ของสต็อก (คงคลัง = sum(qty_change))
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  qty_change int not null,                    -- + รับเข้า, - ขายออก
  reason text not null check (reason in ('purchase','sale','adjust','return')),
  ref_sale_id uuid,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on public.stock_movements(org_id);
create index on public.stock_movements(product_id);

-- sales: บิลขาย
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  bill_no text not null,
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  payment_method text not null check (payment_method in ('cash','promptpay')),
  cash_received numeric(12,2),
  change_due numeric(12,2),
  cashier_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on public.sales(org_id, created_at desc);

-- sale_items
create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name_snapshot text not null,
  unit_price numeric(12,2) not null,
  qty int not null,
  line_total numeric(12,2) not null
);
create index on public.sale_items(sale_id);

-- updated_at triggers
create trigger trg_org_updated   before update on public.organizations for each row execute function public.set_updated_at();
create trigger trg_prod_updated  before update on public.products      for each row execute function public.set_updated_at();

-- ============================================================
-- VIEW: คงคลังปัจจุบันต่อสินค้า
-- ============================================================
create view public.product_stock
with (security_invoker = on) as
  select p.id as product_id,
         p.org_id,
         coalesce(sum(m.qty_change), 0)::int as qty
  from public.products p
  left join public.stock_movements m on m.product_id = p.id
  group by p.id, p.org_id;

-- ============================================================
-- AUTH helpers (SECURITY DEFINER → กัน recursion ใน RLS)
-- ============================================================
create or replace function public.is_org_member(_org_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = _org_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_owner(_org_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = _org_id and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- ============================================================
-- TRIGGER: สร้าง profile อัตโนมัติเมื่อมี user ใหม่
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RPC: สร้างร้าน + ตั้งผู้สมัครเป็น owner + เริ่ม trial 14 วัน
-- ============================================================
create or replace function public.create_organization(_name text, _promptpay text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _org_id uuid;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.organizations (name, promptpay_id)
  values (_name, _promptpay)
  returning id into _org_id;

  insert into public.memberships (org_id, user_id, role)
  values (_org_id, _uid, 'owner');

  insert into public.subscriptions (org_id, status, trial_ends_at)
  values (_org_id, 'trialing', now() + interval '14 days');

  return _org_id;
end;
$$;

-- ============================================================
-- RPC: จบบิล (atomic) — บันทึก sale + items + ตัดสต็อก
-- _items: jsonb array ของ { product_id, name, unit_price, qty }
-- ============================================================
create or replace function public.checkout_sale(
  _org_id uuid,
  _items jsonb,
  _payment_method text,
  _discount numeric default 0,
  _cash_received numeric default null
)
returns json language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _sale_id uuid;
  _bill_no text;
  _subtotal numeric(12,2) := 0;
  _total numeric(12,2);
  _change numeric(12,2);
  _seq int;
  _item jsonb;
begin
  if not public.is_org_member(_org_id) then
    raise exception 'forbidden';
  end if;
  if _items is null or jsonb_array_length(_items) = 0 then
    raise exception 'empty cart';
  end if;

  -- รวมยอด
  select coalesce(sum((i->>'unit_price')::numeric * (i->>'qty')::int), 0)
    into _subtotal
  from jsonb_array_elements(_items) i;

  _total := greatest(_subtotal - coalesce(_discount,0), 0);

  if _payment_method = 'cash' then
    _change := coalesce(_cash_received,0) - _total;
    if _change < 0 then
      raise exception 'cash received less than total';
    end if;
  end if;

  -- เลขบิล: YYYYMMDD-#### (นับต่อร้านต่อวัน)
  select count(*) + 1 into _seq
  from public.sales
  where org_id = _org_id and created_at::date = now()::date;
  _bill_no := to_char(now(), 'YYYYMMDD') || '-' || lpad(_seq::text, 4, '0');

  insert into public.sales (org_id, bill_no, subtotal, discount, total,
                            payment_method, cash_received, change_due, cashier_id)
  values (_org_id, _bill_no, _subtotal, coalesce(_discount,0), _total,
          _payment_method, _cash_received, _change, _uid)
  returning id into _sale_id;

  -- รายการ + ตัดสต็อก
  for _item in select * from jsonb_array_elements(_items) loop
    insert into public.sale_items (sale_id, product_id, name_snapshot, unit_price, qty, line_total)
    values (
      _sale_id,
      (_item->>'product_id')::uuid,
      _item->>'name',
      (_item->>'unit_price')::numeric,
      (_item->>'qty')::int,
      (_item->>'unit_price')::numeric * (_item->>'qty')::int
    );

    insert into public.stock_movements (org_id, product_id, qty_change, reason, ref_sale_id, created_by)
    values (_org_id, (_item->>'product_id')::uuid, -1 * (_item->>'qty')::int, 'sale', _sale_id, _uid);
  end loop;

  return json_build_object('sale_id', _sale_id, 'bill_no', _bill_no,
                           'total', _total, 'change', _change);
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships   enable row level security;
alter table public.subscriptions enable row level security;
alter table public.categories    enable row level security;
alter table public.products      enable row level security;
alter table public.stock_movements enable row level security;
alter table public.sales         enable row level security;
alter table public.sale_items    enable row level security;

-- profiles: เจ้าของแถวเท่านั้น
create policy "own profile read"   on public.profiles for select using (id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid());

-- organizations: สมาชิกอ่านได้, owner แก้ได้
create policy "org member read"  on public.organizations for select using (public.is_org_member(id));
create policy "org owner update" on public.organizations for update using (public.is_org_owner(id));

-- memberships: ผู้ใช้เห็นแถวตัวเอง; owner เห็น/จัดการทั้งร้าน
create policy "membership self read"   on public.memberships for select using (user_id = auth.uid() or public.is_org_owner(org_id));
create policy "membership owner manage" on public.memberships for all using (public.is_org_owner(org_id)) with check (public.is_org_owner(org_id));

-- subscriptions: สมาชิกอ่านได้ (เขียนผ่าน service role/webhook เท่านั้น)
create policy "sub member read" on public.subscriptions for select using (public.is_org_member(org_id));

-- categories / products / stock_movements / sales / sale_items: สมาชิกของร้าน
create policy "cat member all"   on public.categories      for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "prod member all"  on public.products        for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "stock member all" on public.stock_movements for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "sales member all" on public.sales           for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "saleitem member all" on public.sale_items   for all
  using (exists (select 1 from public.sales s where s.id = sale_id and public.is_org_member(s.org_id)))
  with check (exists (select 1 from public.sales s where s.id = sale_id and public.is_org_member(s.org_id)));
