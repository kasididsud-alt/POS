"use server";

import { query } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { adminEmails } from "@/lib/admin";
import { sendContactNotification } from "@/lib/mailer";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

type Result = { ok: boolean; error?: string };

const TOPICS = [
  "ปัญหาการใช้งาน",
  "สอบถามแพ็กเกจ/องค์กรใหญ่",
  "ขอเปิดการเชื่อมต่อ (Shopee/Lazada/ขนส่ง ฯลฯ)",
  "ข้อเสนอแนะ",
  "อื่นๆ",
];

/** ส่งข้อความถึงทีมงาน — เก็บ DB เสมอ, อีเมลแจ้งแอดมินเป็น best-effort (ล่มไม่ทำให้ส่งไม่สำเร็จ) */
export async function sendContactMessage(formData: FormData): Promise<Result> {
  try {
    const ctx = await getAppContext();
    if (!ctx?.org) throw new Error("unauthorized");

    // กันสแปม: 5 ข้อความ/นาที ต่อ org พอสำหรับใช้งานจริง
    const rl = rateLimit(`contact:${ctx.org.id}`, 5);
    if (!rl.ok) return { ok: false, error: "ส่งถี่เกินไป — รอสักครู่แล้วลองใหม่" };

    const topic = String(formData.get("topic") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();
    if (!TOPICS.includes(topic)) return { ok: false, error: "เลือกหัวข้อก่อน" };
    if (message.length < 5) return { ok: false, error: "พิมพ์รายละเอียดอย่างน้อยสักหน่อยครับ" };
    if (message.length > 4000) return { ok: false, error: "ข้อความยาวเกิน 4,000 ตัวอักษร" };

    await query(
      "insert into contact_messages (org_id, user_id, topic, message) values ($1,$2,$3,$4)",
      [ctx.org.id, ctx.userId, topic, message],
    );

    // อีเมลแจ้งแอดมิน — พังเงียบได้ (ข้อความอยู่ใน DB แล้ว แอดมินเห็นใน /admin เสมอ)
    sendContactNotification(adminEmails(), {
      orgName: ctx.org.name,
      fromEmail: ctx.email ?? "(ไม่ทราบอีเมล)",
      topic,
      message,
    }).catch((e) => console.error("[contact] email notify failed:", e?.message));

    await logAudit(ctx.org.id, ctx.userId, "contact.send", topic);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
