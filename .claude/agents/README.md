# ทีม AI ของ ขายดี Stock

Subagents สำหรับ Claude Code — Claude จะเลือกใช้เองอัตโนมัติตามงาน หรือสั่งตรงได้ เช่น "ให้ tech-lead วางแผนฟีเจอร์นี้" / "ให้ security-auditor ตรวจโค้ดที่เพิ่งแก้"

| Agent | หน้าที่ | ใช้เมื่อ |
|---|---|---|
| **tech-lead** | ที่ปรึกษาผู้สร้างระบบ (read-only) | วางแผนฟีเจอร์, ตัดสินใจสถาปัตยกรรม, จัดลำดับงาน |
| **frontend-dev** | UI / หน้าเว็บ | งานใน app/, components/, Tailwind, หน้า POS |
| **database-engineer** | ฐานข้อมูล | schema, migration, stock ต่อสาขา, query |
| **billing-engineer** | เงิน/สมาชิก | Stripe, PromptPay, tiers, การจำกัดสิทธิ์ |
| **api-engineer** | REST API | /api/v1, API keys, rate limit, proxy.ts |
| **qa-engineer** | ทดสอบ | เขียน/รันเทสต์, ตรวจงานก่อนปิดจ๊อบ |
| **security-auditor** | ความปลอดภัย (read-only) | ตรวจ auth, multi-tenant leak, ก่อน deploy |
| **thai-copywriter** | ข้อความภาษาไทย | copy บนเว็บ, error message, SEO, อีเมล |

## เวิร์กโฟลว์ที่แนะนำ

- **ฟีเจอร์ใหม่:** tech-lead วางแผน → agent สายที่เกี่ยวข้องลงมือ → qa-engineer ตรวจ → (ถ้าแตะ auth/เงิน/API) security-auditor ตรวจปิดท้าย
- **แก้บั๊ก:** qa-engineer เขียนเทสต์ที่พังก่อน → agent เจ้าของโซนแก้ → รันเทสต์ทั้งชุด
- **ก่อน deploy:** security-auditor + `npm test`

ทุก agent รู้กติกาโปรเจกต์แล้ว: Next.js 16 ต้องอ่าน docs ใน node_modules ก่อนเขียน, dev server port 3020, เทสต์ด้วย node:test, แบรนด์คือ "ขายดี Stock"
