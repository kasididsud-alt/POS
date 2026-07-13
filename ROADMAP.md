# แนวทางการพัฒนา ขายดี Stock

> อัปเดตล่าสุด: 2026-07-07 — หลังรอบ hardening ใหญ่ (audit ทั้งระบบ + แก้ P1/P2)
> หลักการ: ปิดความเสี่ยงเรื่องเงินก่อน → เก็บรายได้ให้ครบ → ปรับประสิทธิภาพ → ค่อยเพิ่มฟีเจอร์ใหม่

## ✅ รอบ hardening 2026-07-07 (เสร็จแล้ว)

สำรวจทั้งระบบด้วยทีม AI 8 มิติ + adversarial verify → พบ 0 P0, 21 P1, 28 P2 (หลังกรอง) แก้แล้วเกือบทั้งหมด · `npm test` 77/77 เขียว · production build ผ่าน · migration ถึงเลข 27

- Phase 0 เสร็จ: commit ทั้งโปรเจ็ค (เดิม untracked), `.gitignore` + `.env.example` ตรงจริง, ลบ `@supabase/*`, archive migration เก่า
- Phase 1 เสร็จ: login 500 Google-only, /terms + /privacy (PDPA) + proxy allow-list, harden checkout_sale/process_return (ราคาจาก DB, migration 23)
- Phase 2 เสร็จ: user limit ตามแพ็ก (`lib/limits.ts` รวม invite), unique `(org_id, bill_no)`+retry (mig 25), validate org ใน stock RPC/actions, cash_shifts branch_id (mig 24), README/docs
- บัคจาก audit ที่แก้เพิ่ม: PII ลูกค้ารั่วข้าม org บนใบเสร็จ, Stripe portal owner check, webhook idempotency/ordering (mig 27), comp_plan เป็น floor, plan gating ใน server action, transfer/PO double-exec, คืนบิลเครดิตลดหนี้ (mig 26), POS stale stock/exact-cash float/error boundary, held-bills namespace, VAT report หักคืน/rounding/timezone, open redirect, API flood limit
- SEO: canonical ต่อหน้า, robots block /admin+app routes, JSON-LD (SoftwareApplication/Offer/FAQPage), OG ภาษาไทย, sitemap /pricing+terms+privacy

### ค้างไว้เป็น backlog (จาก audit — ยังไม่วิกฤต)
- P2-6: product/user limit เป็น check-then-insert (race เกินโควตาได้เล็กน้อยตอน concurrent) — แก้ด้วย advisory lock หรือ insert...where count<max
- ~~P1-4 ส่วนที่เหลือ: plan gating~~ — ✅ เสร็จ 2026-07-13: `assertPlanAllows` ครบ 12 โมดูล (รวม pro-tier: customers/members/sales-orders/staff ที่ ROADMAP เดิมตกสำรวจ) + test/plan-gating.test.ts ~60 เทสต์; action ฝั่ง "ปิดงานเก่า/ลดข้อมูล" (receivePO, setTransferStatus, recordPayment, delete*) จงใจไม่ gate เพื่อไม่ให้ร้านดาวน์เกรดมีสต็อก/หนี้ค้าง (มี comment ในโค้ด)
- ~~`po_no`/`so_no` ยังใช้ count(*)+1~~ — ✅ เสร็จ 2026-07-13: migration 28 (dedup เก่า + unique (org_id, po_no)/(org_id, so_no) + max(regexp)+retry ตามแบบ 25) + test/integration.docno.test.ts; seq เปลี่ยนเป็นนับต่อเดือนตาม prefix POYYYYMM/SOYYYYMM
- P2-24: landing/pricing ถูกบังคับ dynamic เพราะ getAppContext อ่าน cookie — แยก `<AuthNavCta>` เป็น client component เพื่อ cache ได้
- debt ผูกกับ sale ผ่าน note string — ควรเพิ่ม `debts.sale_id`
- rate limit/held-bills เป็น in-memory ต่อ instance — ย้าย Redis เมื่อ scale
- ~~นโยบายสิทธิ์ cashier~~ — ✅ เสร็จ 2026-07-13: เพิ่ม role "ผู้จัดการ" (migration 29) เป็น 3 ระดับ cashier < manager < owner; MIN_ROLE_FOR_PATH ใน nav.ts (จัดซื้อ/ซัพพลายเออร์/โปรโมชั่น = manager+, เงิน/กำไร/ภาษี/ทีมงาน/ตั้งค่า = owner) + assertRoleAtLeast ราย action (แก้ราคา/ลบ/ปรับยอด/แต้ม/ตัดจ่าย/ใบโอน/ออเดอร์ = manager+) + test/role-gating.test.ts
- (จากรอบเช็ค role 2026-07-13) pricing โฆษณา "สิทธิ์ละเอียด + audit log" (Premium) และ "สร้าง Role เอง" (Enterprise) — ตอนนี้มี 3 role แล้วจึงพอเรียก "แยกสิทธิ์" ได้ แต่ "สร้าง Role เอง" (custom RBAC) ยังไม่มีจริง + audit log ยังมี event น้อย — ถอดข้อความหรือสร้างจริง (แบบเดียวกับเคส FEFO)

## กติกาการทำงาน (ใช้ทุกเฟส)

- โค้ดที่แตะ **เงิน / สต็อก / auth** ต้องเขียน integration test ก่อนหรือพร้อมกับโค้ด (test-first)
- ทุกงานจบด้วย `npm test` เขียว + ลองจริงบน dev (port 3020) + commit เป็น commit เดี่ยวที่อธิบายตัวเองได้
- Migration ใหม่เพิ่มเป็นไฟล์ใน `db/modules/` (ตัวเลขถัดไปคือ 22) รันผ่าน `scripts/migrate.mjs`
- main = deployable เสมอ งานใหญ่แตก branch

---

## Phase 0 — วางฐาน (ครึ่งวัน) ✅ เมื่อโค้ดอยู่บน remote

เหตุผล: ตอนนี้โค้ด ~13k บรรทัดเป็น untracked ทั้งหมด ทุกงานถัดไปต้องมีจุด rollback ก่อน

- [ ] แก้ `.gitignore`: เพิ่ม `!.env.example`
- [ ] ล้าง `.env.example`: ลบ Supabase keys ที่ไม่ใช้, ใส่ ENV จริงให้ครบ (DATABASE_URL, STRIPE_*, ADMIN_EMAILS, GOOGLE_*, GMAIL_*, NEXT_PUBLIC_SITE_URL, COOKIE_SECURE)
- [ ] Commit ทั้งโปรเจ็ค + สร้าง GitHub repo (private) + push

## Phase 1 — ปิดช่องเงิน/ความปลอดภัย (2–3 วัน) ✅ เมื่อ "ปลอดภัยพอรับเงินจริง"

เรียงจากเร็วไปช้า เก็บ quick win ก่อน:

- [ ] **แก้ login 500 บัญชี Google-only** (S) — `app/(auth)/actions.ts`: ถ้า `password_hash` เป็น null ให้คืน error กลาง ๆ เดียวกับรหัสผิด (กัน account enumeration)
- [ ] **สร้างหน้า /terms + /privacy** (S) — เนื้อหาภาษาไทยรองรับ PDPA (ใช้ thai-copywriter ร่าง) ลิงก์จาก signup ต้องไม่ 404
- [ ] **Hardening checkout_sale / process_return** (M, test-first) — `db/modules/` migration 22:
  - ราคาอ่านจาก DB ฝั่ง server — client ส่งแค่ `product_id + qty` ส่วนลดส่งแยกเป็น field และจำกัดเพดาน
  - validate `qty > 0`, product/branch เป็นของ org
  - `process_return`: เช็ค sale เป็นของ org + ยอดคืนสะสมต่อรายการ ≤ ยอดที่ขายจริง
  - เขียน integration test ครอบ: ราคาโดนแก้จาก client, qty ติดลบ, คืนเกิน, คืนข้าม org
- [x] **แก้ Stripe subscription ซ้อน** (M, test-first) — ✅ เสร็จ 2026-07-07:
  - มี sub active/trialing/past_due → `stripe.subscriptions.update` เปลี่ยน price บนตัวเดิม (proration, เคลียร์ cancel_at_period_end), sub ตาย/ไม่มี → checkout ตามเดิม, price เดิม → noop
  - เพิ่ม owner check ฝั่ง server ใน checkout route ด้วย
  - test/billing.test.ts 15 เทสต์ (fake stripe) — เหลือลองจริงใน Stripe test mode ก่อนขึ้น prod (ดู checklist ท้ายรายงาน billing-engineer)

## Phase 2 — เก็บรายได้ให้ครบ + ความถูกต้องข้อมูล (~1 สัปดาห์) ✅ เมื่อพร้อม launch

- [ ] **Enforce user limit ตามแพ็ก** (S) — Free 1 / Pro 5 / Premium+ ∞; ยุบ logic invite ที่ซ้ำกันใน `staff/actions.ts` + `settings/actions.ts` ให้เหลือฟังก์ชันเดียวใน `lib/limits.ts` (ลิมิตนี้คือตัวขับอัปเกรด — สำคัญต่อรายได้โดยตรง)
- [ ] **unique index `(org_id, bill_no)`** (S) — + retry loop ตอนชนกัน แก้เลขบิลซ้ำ/oversell ตอน concurrent
- [ ] **Validate org ownership ใน RPC สต็อกทุกตัว** (M) — `issueStock`, `createTransfer`, `checkout_sale` และ `/api/v1/products` ต้องกรอง org/branch ให้เป็น invariant เดียวกับ `receivePO` (ใช้เป็นต้นแบบ)
- [ ] **cash_shifts เพิ่ม branch_id** (S) — migration + แก้ `shifts/actions.ts` ให้ expected_cash คิดต่อสาขา
- [ ] **เอกสารให้ตรงความจริง** (S) — README (ชื่อ ขายดี Stock, port 3020, สถาปัตยกรรมจริง), ลบ `@supabase/*` ออกจาก package.json, archive `supabase/migrations/0001_init.sql`
- [ ] **เพิ่ม test ฝั่งเงิน** (M) — webhook events, plan gating (`lib/limits.ts`, `nav.ts`), user limit

## Phase 3 — ประสิทธิภาพ + ความน่าเชื่อถือ (ทยอยหลัง launch)

- [ ] **Pagination หน้าสินค้า + แยกรูปออกจาก list query** (M) — base64 ใน list ทำหน้าอืดที่ 5k รายการ (ร้าน Premium เจอก่อนใคร)
- [ ] **Audit log ครอบ action สำคัญ** (M) — checkout, return, transfer, staff, billing (ตอนนี้มีจริง 2 event แต่ขายเป็นฟีเจอร์ Premium)
- [ ] **SO fulfill ตัดสต็อกจริง** (M) — ปิด loop ขายส่ง

## Phase 4 — ของใหม่ (เมื่อมี demand จริง)

- [ ] **FEFO**: ถอดคำว่า "FEFO" ออกจากหน้า pricing ก่อน (S) → ค่อยสร้างจริงโดยผูก lot กับ stock_movements (L)
- [ ] **ขยาย /api/v1** — pagination, stock endpoint, POST, เอกสาร API (ก่อนขาย Enterprise จริงจัง)
- [ ] **Enterprise multi-org/RBAC** — รอลูกค้า Enterprise รายแรกค่อยทำ
- [ ] **Rate limit ย้าย Redis** — เมื่อ scale เกิน 1 instance เท่านั้น

## ข้อควรระวังตอน deploy

- ห้ามตั้ง `DEV_PLAN` ใน production — จะ override แพ็กทุกร้านทั้งระบบ (`lib/plans.ts`)
- `SITE_URL` fallback ยังเป็น localhost:3000 — ต้องตั้ง `NEXT_PUBLIC_SITE_URL` เสมอ
- `COOKIE_SECURE=true` ใน production
