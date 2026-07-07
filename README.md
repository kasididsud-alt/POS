# 🧾 ขายดี Stock — ระบบคลังสินค้า + แคชเชียร์ (SaaS)

ระบบจัดการคลังสินค้าและขายหน้าร้าน (POS) แบบ multi-tenant ขายเป็น subscription รายเดือน/รายปี
รองรับร้านค้าหน้าร้าน ร้านออนไลน์ และคลังสินค้า — หลายสาขา สต็อกแยกต่อสาขา

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · **PostgreSQL (local, embedded — ไม่ต้องใช้ Docker)** · built-in auth (bcrypt + session cookie) · Google Sign-In (optional) · Stripe (optional) · PromptPay QR

## ▶️ รันบนเครื่อง (local) — ไม่ต้องลง Docker/Postgres เอง

เปิด **2 เทอร์มินัล**:

```bash
# เทอร์มินัล 1 — ฐานข้อมูล (PostgreSQL ฝังตัว รันด้วย Node)
npm run db        # ครั้งแรกจะดาวน์โหลด binary + สร้างตาราง อัตโนมัติ

# เทอร์มินัล 2 — เว็บแอป
npm run dev       # เปิดที่พอร์ต 3020
```
เปิด http://localhost:3020 → กด **สมัครใช้งาน** → ตั้งชื่อร้าน → ล็อกอินได้ทันที ใช้งานครบทั้ง POS/สต็อก/รายงาน

> ข้อมูลเก็บในโฟลเดอร์ `.localdb/` (ถูก gitignore แล้ว) — schema อยู่ที่ [`db/schema.sql`](db/schema.sql)
> migration รายตัวอยู่ที่ `db/modules/` รันด้วย `npm run migrate`
> ระบบล็อกอินเป็นแบบ built-in (รหัสผ่าน hash ด้วย bcrypt, session เก็บใน DB) ไม่ต้องพึ่งบริการภายนอก

## 🧪 เทสต์

```bash
npm test          # node:test — unit + integration (ต้องมี DB local รันอยู่สำหรับ integration)
```

## 🚀 ขึ้น Production (deploy)

1. เตรียม PostgreSQL จริง (Neon / RDS / VM) → ได้ `DATABASE_URL`
2. รัน migration ลงฐานข้อมูล prod:
   ```bash
   DATABASE_URL=postgresql://user:pass@host:5432/db npm run migrate
   ```
3. ตั้ง env ตอน deploy (ดูรายการเต็มใน [`.env.example`](.env.example)):
   - `DATABASE_URL` = Postgres prod
   - `COOKIE_SECURE=true` (สำคัญ! เพราะ prod เป็น HTTPS)
   - `NEXT_PUBLIC_SITE_URL=https://your-domain` (ห้ามปล่อย fallback localhost)
   - **ห้ามตั้ง `DEV_PLAN`** — จะ override แพ็กเกจทุกร้านทั้งระบบ
   - (ถ้าเปิดเก็บค่าบริการ) `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PRICE_*`
   - (ถ้าเปิด Google Sign-In) `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - (ถ้าเปิดอีเมลรีเซ็ตรหัสผ่าน) `GMAIL_USER`, `GMAIL_APP_PASSWORD`
   - (ถ้าเปิดหน้า /admin) `ADMIN_EMAILS`
4. `npm run build && npm run start` (หรือ deploy บน Vercel)

> ความปลอดภัยที่มีให้แล้ว: รหัสผ่าน hash (bcrypt), session httpOnly cookie, สิทธิ์ตาม role (เจ้าของ/พนักงาน),
> กันยิงรหัสผ่านรัว (ล็อก 15 นาทีหลังพลาด 5 ครั้ง), กันขายเกินสต็อก, audit log, rate limit ที่ proxy

## โมดูลที่มี (ทุกเมนูเป็นของจริง)
**ขาย:** POS · ประวัติบิล · คืนสินค้า/คืนเงิน · เปิด-ปิดกะ/นับเงิน · รายงาน
**สินค้า:** รายการสินค้า · หมวดหมู่ · โปรโมชั่น · Lot/วันหมดอายุ
**คลัง:** คงคลัง+ประวัติ · รับสินค้าเข้า · เบิก/ตัดจ่าย · โอนย้ายสาขา · ตรวจนับ · ตำแหน่งจัดเก็บ
**จัดซื้อ:** ซัพพลายเออร์ · ใบสั่งซื้อ (PO)
**ลูกค้า:** CRM · สมาชิก/แต้ม · ออเดอร์ขายส่ง · ลูกหนี้/เครดิต
**ตั้งค่า:** ร้าน · สาขา/คลัง · พนักงาน&สิทธิ์ · การเชื่อมต่อ (API keys) · แจ้งเตือน
**แพลตฟอร์ม:** หน้าผู้ดูแลระบบ `/admin` (allowlist ตาม `ADMIN_EMAILS`) · REST API `/api/v1` (bearer key)

## ฟีเจอร์
- 🔐 สมัคร/ล็อกอิน (อีเมล+รหัสผ่าน หรือ Google) + สร้างร้าน + ทีมงาน (เจ้าของ / พนักงาน) แยกข้อมูลแต่ละร้านด้วย org scoping ฝั่ง server
- 📦 จัดการสินค้า + หมวดหมู่ + รับสต็อก/ปรับยอด + แจ้งเตือนสินค้าใกล้หมด (คงคลังคำนวณจาก ledger, แยกต่อสาขา)
- 🧾 หน้าแคชเชียร์ (POS): สแกน/เลือกสินค้า → ตะกร้า → จ่ายเงินสด/พร้อมเพย์ → ตัดสต็อกอัตโนมัติ → ใบเสร็จ
- 🏷️ สร้าง/พิมพ์บาร์โค้ดในตัว (CODE128 / EAN-13 — ไม่พึ่งบริการภายนอก) + หน้าพิมพ์ป้ายราคา
- 🧾 ใบกำกับภาษี (อย่างย่อ + เต็มรูป): เปิด VAT ในตั้งค่าร้าน → แสดงมูลค่าก่อน VAT + ภาษีอัตโนมัติ (ราคารวม VAT) + พิมพ์กระดาษความร้อน 58/80mm/A4
- 📑 รายงานภาษีขาย (ภ.พ.30) รายเดือน + รายงานยอดขายแยกตามพนักงาน
- 📲 ติดตั้งเป็นแอป (PWA) ลงมือถือ/เดสก์ท็อปได้ + รองรับเครื่องสแกนบาร์โค้ด USB ที่หน้า POS
- 📊 Dashboard ยอดขายวันนี้ + สินค้าใกล้หมด + มูลค่าสต็อก + ประวัติบิล
- 💳 ระบบ subscription ผ่าน Stripe 4 แพ็ก (เริ่มต้นฟรี / ร้านค้า ฿399 / มืออาชีพ ฿990 / Enterprise) + ทดลองฟรี 14 วัน + Customer Portal

## โครงสร้างโปรเจกต์
```
app/
  page.tsx                 # Landing
  pricing/                 # หน้าแพ็กเกจ
  (auth)/login, /signup    # ล็อกอิน/สมัคร (+ สร้างร้าน)
  onboarding/              # สร้างร้านกรณีล็อกอินแล้วยังไม่มีร้าน
  (app)/dashboard          # ภาพรวม
  (app)/pos                # แคชเชียร์ (หัวใจของระบบ)
  (app)/products ฯลฯ       # สินค้า / คลัง / จัดซื้อ / รายงาน / ตั้งค่า
  (admin)/admin            # แผงผู้ดูแลแพลตฟอร์ม
  api/stripe/{checkout,portal,webhook}
  api/v1/                  # REST API สำหรับลูกค้า Enterprise (bearer key)
db/
  schema.sql               # schema เต็ม (สำหรับสร้างใหม่)
  modules/                 # migration รายตัว (รันผ่าน scripts/migrate.mjs)
lib/
  auth.ts, session.ts, guard.ts, limits.ts, plans.ts, billing.ts, stripe.ts,
  queries.ts, vat.ts, promptpay.ts, barcode.ts, rate-limit.ts, ...
scripts/
  db.mjs                   # embedded Postgres สำหรับ dev
  migrate.mjs              # ตัวรัน migration
proxy.ts                   # session refresh + route guard + rate limit (Next 16)
test/                      # node:test — unit + integration
```

## หมายเหตุ
- การจ่ายพร้อมเพย์เป็นแบบ **สร้าง QR + ยืนยันด้วยมือ** (ยังไม่ตัดเงินอัตโนมัติ) — เฟสถัดไปต่อ Omise เพื่อยืนยันยอดอัตโนมัติได้
- ราคา/ลิมิตของแต่ละแพ็กกำหนดใน [`lib/plans.ts`](lib/plans.ts) — จำนวนเงินที่เก็บจริงกำหนดที่ Stripe Price
- แผนงานถัดไปดู [`ROADMAP.md`](ROADMAP.md)
