# 🧾 StockPOS — ระบบคลังสินค้า + แคชเชียร์ (SaaS)

ระบบจัดการคลังสินค้าและขายหน้าร้าน (POS) แบบ multi-tenant ขายเป็น subscription รายเดือน/รายปี
รองรับร้านค้าหน้าร้าน ร้านออนไลน์ และคลังสินค้า

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · **PostgreSQL (local, embedded — ไม่ต้องใช้ Docker)** · built-in auth (bcrypt + session cookie) · Stripe (optional) · PromptPay QR

## 🚀 ขึ้น Production (deploy)

1. เตรียม PostgreSQL จริง (Supabase / Neon / RDS / VM) → ได้ `DATABASE_URL`
2. รัน migration ลงฐานข้อมูล prod:
   ```bash
   DATABASE_URL=postgresql://user:pass@host:5432/db npm run migrate
   ```
3. ตั้ง env ตอน deploy (Vercel/VM):
   - `DATABASE_URL` = Postgres prod
   - `COOKIE_SECURE=true` (สำคัญ! เพราะ prod เป็น HTTPS)
   - `NEXT_PUBLIC_SITE_URL=https://your-domain`
   - (ถ้าเปิดเก็บค่าบริการ) `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PRICE_*`
4. `npm run build && npm run start` (หรือ deploy บน Vercel)

> ความปลอดภัยที่มีให้แล้ว: รหัสผ่าน hash (bcrypt), session httpOnly cookie, สิทธิ์ตาม role (เจ้าของ/พนักงาน),
> กันยิงรหัสผ่านรัว (ล็อก 15 นาทีหลังพลาด 5 ครั้ง), กันขายเกินสต็อก, audit log

## ▶️ รันบนเครื่อง (local) — ไม่ต้องลง Docker/Postgres เอง

เปิด **2 เทอร์มินัล**:

```bash
# เทอร์มินัล 1 — ฐานข้อมูล (PostgreSQL ฝังตัว รันด้วย Node)
npm run db        # ครั้งแรกจะดาวน์โหลด binary + สร้างตาราง อัตโนมัติ

# เทอร์มินัล 2 — เว็บแอป
npm run dev
```
เปิด http://localhost:3000 → กด **สมัครใช้งาน** → ตั้งชื่อร้าน → ล็อกอินได้ทันที ใช้งานครบทั้ง POS/สต็อก/รายงาน

> ข้อมูลเก็บในโฟลเดอร์ `.localdb/` (ถูก gitignore แล้ว) — schema อยู่ที่ [`db/schema.sql`](db/schema.sql)
> ระบบล็อกอินเป็นแบบ built-in (รหัสผ่าน hash ด้วย bcrypt, session เก็บใน DB) ไม่ต้องพึ่งบริการภายนอก

## โมดูลที่มี (ทุกเมนูเป็นของจริง)
**ขาย:** POS · ประวัติบิล · คืนสินค้า/คืนเงิน · เปิด-ปิดกะ/นับเงิน · รายงาน
**สินค้า:** รายการสินค้า · หมวดหมู่ · โปรโมชั่น · Lot/วันหมดอายุ
**คลัง:** คงคลัง+ประวัติ · รับสินค้าเข้า · เบิก/ตัดจ่าย · โอนย้ายสาขา · ตรวจนับ · ตำแหน่งจัดเก็บ
**จัดซื้อ:** ซัพพลายเออร์ · ใบสั่งซื้อ (PO)
**ลูกค้า:** CRM · สมาชิก/แต้ม · ออเดอร์ขายส่ง · ลูกหนี้/เครดิต
**ตั้งค่า:** ร้าน · สาขา/คลัง · พนักงาน&สิทธิ์ · การเชื่อมต่อ · แจ้งเตือน

## ฟีเจอร์
- 🔐 สมัคร/ล็อกอิน + สร้างร้าน + ทีมงาน (เจ้าของ / พนักงาน) แยกข้อมูลแต่ละร้านด้วย RLS
- 📦 จัดการสินค้า + หมวดหมู่ + รับสต็อก/ปรับยอด + แจ้งเตือนสินค้าใกล้หมด (คงคลังคำนวณจาก ledger)
- 🧾 หน้าแคชเชียร์ (POS): สแกน/เลือกสินค้า → ตะกร้า → จ่ายเงินสด/พร้อมเพย์ → ตัดสต็อกอัตโนมัติ → ใบเสร็จ
- 🏷️ สร้าง/พิมพ์บาร์โค้ดในตัว (CODE128 — ไม่พึ่งบริการภายนอก): สร้างเลข EAN-13 ภายในร้านอัตโนมัติ + หน้าพิมพ์ป้ายราคา
- 🧾 ใบกำกับภาษี (อย่างย่อ + เต็มรูป): เปิด VAT ในตั้งค่าร้าน → ใบเสร็จแสดงมูลค่าก่อน VAT + ภาษี 7% อัตโนมัติ (ราคารวม VAT) + สลับใบกำกับเต็มรูป (ข้อมูลผู้ซื้อ) + พิมพ์กระดาษความร้อน 58/80mm/A4
- 📑 รายงานภาษีขาย (ภ.พ.30) รายเดือน + รายงานยอดขายแยกตามพนักงาน
- 📲 ติดตั้งเป็นแอป (PWA) ลงมือถือ/เดสก์ท็อปได้ + รองรับเครื่องสแกนบาร์โค้ด USB ที่หน้า POS
- 📊 Dashboard ยอดขายวันนี้ + สินค้าใกล้หมด + มูลค่าสต็อก + ประวัติบิล
- 💳 ระบบ subscription ผ่าน Stripe + ทดลองฟรี 14 วัน + Customer Portal

---

## เริ่มต้นใช้งาน

### 1. ติดตั้ง dependencies
```bash
npm install
```

### 2. ตั้งค่า Supabase
1. สร้างโปรเจกต์ที่ https://supabase.com (ฟรี)
2. ไปที่ **SQL Editor** → รันไฟล์ [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) ทั้งไฟล์
3. ไปที่ **Project Settings → API** คัดลอกค่าใส่ `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (เก็บเป็นความลับ ใช้ฝั่ง webhook/เชิญทีมงาน)
4. (แนะนำตอน dev) ปิดการยืนยันอีเมล: **Authentication → Sign In/Up → ปิด "Confirm email"**
   เพื่อให้สมัครแล้วเข้าใช้งานได้ทันที

### 3. ตั้งค่า Stripe (ทำภายหลังได้ — แอปรันได้โดยไม่ต้องมีก่อน)
1. สมัคร https://stripe.com → เปิด **Test mode**
2. สร้าง 1 Product + 2 Prices (recurring): รายเดือน และ รายปี → คัดลอก Price ID
3. ใส่ `.env.local`:
   - `STRIPE_SECRET_KEY`
   - `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY`, `NEXT_PUBLIC_STRIPE_PRICE_YEARLY`
4. ทดสอบ webhook ในเครื่อง:
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   นำค่า `whsec_...` ที่ได้ใส่ `STRIPE_WEBHOOK_SECRET`

### 4. รัน
```bash
npm run dev
```
เปิด http://localhost:3000

---

## โครงสร้างโปรเจกต์
```
app/
  page.tsx                 # Landing + Pricing
  (auth)/login, /signup    # ล็อกอิน/สมัคร (+ สร้างร้าน)
  onboarding/              # สร้างร้านกรณีล็อกอินแล้วยังไม่มีร้าน
  (app)/dashboard          # ภาพรวม
  (app)/pos                # แคชเชียร์ (หัวใจของระบบ)
  (app)/products           # สินค้า / คลัง
  (app)/sales              # ประวัติการขาย + ใบเสร็จ
  (app)/settings           # ตั้งค่าร้าน / ทีมงาน / แพ็กเกจ
  api/stripe/{checkout,portal,webhook}
lib/
  supabase/                # client / server / admin / proxy helpers
  auth.ts, queries.ts, stripe.ts, billing.ts, promptpay.ts, format.ts, types.ts
supabase/migrations/0001_init.sql
proxy.ts                   # refresh session + กันเส้นทาง (Next 16 middleware)
```

## การทดสอบ (เมื่อใส่คีย์ครบ)
1. สมัคร → สร้างร้านอัตโนมัติ → เข้า `/dashboard`
2. `/products` เพิ่มสินค้า + สต็อกตั้งต้น → คงคลังขึ้น
3. `/pos` เลือกสินค้า → จ่ายเงินสด → จบบิล → คงคลังลด, บิลบันทึกใน `/sales`
4. ตั้งเบอร์พร้อมเพย์ใน `/settings` → ทดสอบจ่ายแบบพร้อมเพย์ (สแกน QR ด้วยแอปธนาคาร)
5. Stripe: ที่ `/settings` กดเลือกแพ็กเกจ → จ่ายด้วยบัตรทดสอบ `4242 4242 4242 4242`
   → ตรวจว่าตาราง `subscriptions` อัปเดตเป็น `active`

## หมายเหตุ
- การจ่ายพร้อมเพย์เป็นแบบ **สร้าง QR + ยืนยันด้วยมือ** (ยังไม่ตัดเงินอัตโนมัติ) — เฟสถัดไปต่อ Omise เพื่อยืนยันยอดอัตโนมัติได้
- ราคาในตัวอย่าง (฿299/เดือน, ฿2,990/ปี) เป็นข้อความแสดงผล จำนวนเงินจริงกำหนดที่ Stripe Price
