import nodemailer from "nodemailer";

// ส่งอีเมลผ่าน Gmail SMTP (ฟรี) ด้วย App Password
// ต้องตั้ง env: GMAIL_USER, GMAIL_APP_PASSWORD (สร้างจากบัญชี Gmail ที่เปิด 2FA)
// ลิมิตประมาณ ~500 ฉบับ/วัน — พอสำหรับอีเมลรีเซ็ตรหัสผ่าน

export const BRAND = "ขายดี Stock";

export function mailerConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function transport() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

/** ส่งอีเมลลิงก์รีเซ็ตรหัสผ่าน (ลิงก์หมดอายุ 30 นาที) */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  // dev / ยังไม่ตั้งค่า Gmail → log ลิงก์ออก console เพื่อทดสอบ flow ได้
  if (!mailerConfigured()) {
    console.warn(`[mailer] ยังไม่ได้ตั้งค่า Gmail — ลิงก์รีเซ็ต (${to}): ${resetUrl}`);
    return;
  }

  await transport().sendMail({
    from: `${BRAND} <${process.env.GMAIL_USER}>`,
    to,
    subject: `รีเซ็ตรหัสผ่าน ${BRAND}`,
    text:
      `มีคำขอรีเซ็ตรหัสผ่านสำหรับบัญชี ${BRAND} ของคุณ\n\n` +
      `กดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่ (หมดอายุใน 30 นาที):\n${resetUrl}\n\n` +
      `ถ้าคุณไม่ได้เป็นคนขอ ละเลยอีเมลฉบับนี้ได้เลย รหัสผ่านเดิมยังใช้งานได้ตามปกติ`,
    html: `
      <div style="font-family:'Noto Sans Thai',Arial,sans-serif;max-width:480px;margin:0 auto;color:#0f172a">
        <div style="font-size:20px;font-weight:700;margin-bottom:8px">🧾 ${BRAND}</div>
        <h1 style="font-size:18px;margin:16px 0 8px">รีเซ็ตรหัสผ่าน</h1>
        <p style="font-size:14px;line-height:1.6;color:#334155">
          มีคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;margin:16px 0;padding:12px 24px;background:#4f46e5;color:#fff;
                  text-decoration:none;border-radius:10px;font-size:14px;font-weight:600">
          ตั้งรหัสผ่านใหม่
        </a>
        <p style="font-size:13px;color:#64748b;line-height:1.6">
          ลิงก์นี้จะหมดอายุใน <strong>30 นาที</strong><br/>
          ถ้าคุณไม่ได้เป็นคนขอ ละเลยอีเมลฉบับนี้ได้เลย รหัสผ่านเดิมยังใช้งานได้ตามปกติ
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
        <p style="font-size:12px;color:#94a3b8;word-break:break-all">
          ถ้าปุ่มกดไม่ได้ ให้คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:<br/>${resetUrl}
        </p>
      </div>
    `,
  });
}
