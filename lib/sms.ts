/**
 * SMS client (pure — ไม่แตะ DB, unit-test ได้ตรงๆ)
 * ร้านสมัครผู้ให้บริการเอง แล้วเอา credentials มาผูกใน /integrations
 * ค่าส่งต่อข้อความคิดกับบัญชีของร้านโดยตรง
 */
export type SmsProvider = "thaibulksms" | "twilio";

export type SmsCredentials = {
  /** ThaiBulkSMS: api_key / Twilio: Account SID */
  apiKey: string;
  /** ThaiBulkSMS: api_secret / Twilio: Auth Token */
  apiSecret: string;
  /** ชื่อผู้ส่ง (ThaiBulkSMS) / เบอร์ From (Twilio) — บางเจ้าบังคับ */
  sender: string | null;
};

function timeout() {
  return AbortSignal.timeout(10_000);
}

async function readError(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  return `${res.status}: ${body.slice(0, 300)}`;
}

function basicAuth(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

/**
 * เบอร์ไทยเป็นรูปแบบสากล: 0812345678 → 66812345678 (คงเลขล้วน ไม่ใส่ +)
 * เบอร์ที่ขึ้น 66 อยู่แล้ว/เบอร์ต่างชาติ ปล่อยผ่านหลังตัดอักขระคั่น
 */
export function normalizeThaiPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("0") && digits.length === 10) return "66" + digits.slice(1);
  return digits;
}

/** ตรวจว่า credentials ใช้ได้จริง — ยิง endpoint อ่านข้อมูลบัญชี (ไม่ส่งข้อความ ไม่เสียเครดิต) */
export async function validateSmsCredentials(
  provider: SmsProvider,
  creds: SmsCredentials,
): Promise<void> {
  const res =
    provider === "twilio"
      ? await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(creds.apiKey)}.json`,
          {
            headers: { Authorization: basicAuth(creds.apiKey, creds.apiSecret) },
            signal: timeout(),
          },
        )
      : await fetch("https://api-v2.thaibulksms.com/credit", {
          headers: { Authorization: basicAuth(creds.apiKey, creds.apiSecret) },
          signal: timeout(),
        });
  if (!res.ok) throw new Error(`ตรวจ credentials ไม่ผ่าน (${await readError(res)})`);
}

/** ส่ง SMS หนึ่งข้อความ — โยน Error พร้อมรายละเอียดถ้าส่งไม่สำเร็จ */
export async function sendSms(
  provider: SmsProvider,
  creds: SmsCredentials,
  input: { to: string; message: string },
): Promise<void> {
  const to = normalizeThaiPhone(input.to);
  if (!to) throw new Error("เบอร์ปลายทางไม่ถูกต้อง");

  if (provider === "twilio") {
    if (!creds.sender) throw new Error("Twilio ต้องระบุเบอร์ From ในการตั้งค่า");
    const params = new URLSearchParams({
      To: `+${to}`,
      From: creds.sender,
      Body: input.message,
    });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(creds.apiKey)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: basicAuth(creds.apiKey, creds.apiSecret),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
        signal: timeout(),
      },
    );
    if (!res.ok) throw new Error(`ส่ง SMS ไม่สำเร็จ (${await readError(res)})`);
    return;
  }

  // ThaiBulkSMS API v2
  const params = new URLSearchParams({ msisdn: to, message: input.message });
  if (creds.sender) params.set("sender", creds.sender);
  const res = await fetch("https://api-v2.thaibulksms.com/sms", {
    method: "POST",
    headers: {
      Authorization: basicAuth(creds.apiKey, creds.apiSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    signal: timeout(),
  });
  if (!res.ok) throw new Error(`ส่ง SMS ไม่สำเร็จ (${await readError(res)})`);
}
