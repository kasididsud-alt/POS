"use server";

import { revalidatePath } from "next/cache";
import { query, one } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { generateApiKey } from "@/lib/api-keys";
import { logAudit } from "@/lib/audit";
import { assertPlanAllows } from "@/lib/limits";
import { pushLineMessage } from "@/lib/line";
import { validateGatewayKey, type GatewayProvider } from "@/lib/payment-gateway";
import { validateSmsCredentials, type SmsProvider } from "@/lib/sms";

type Result = { ok: boolean; error?: string };

async function requireOwner() {
  const ctx = await getAppContext();
  if (!ctx?.org) throw new Error("unauthorized");
  if (ctx.membership?.role !== "owner")
    throw new Error("เฉพาะเจ้าของร้านเท่านั้น");
  return ctx;
}

/** สร้าง API key ใหม่ — คืน key เต็มกลับครั้งเดียว (เก็บเฉพาะ hash) */
export async function createApiKey(
  formData: FormData,
): Promise<Result & { key?: string }> {
  try {
    const ctx = await requireOwner();
    // API key / การเชื่อมต่อ = ฟีเจอร์แพ็ก Premium — บังคับที่ action ด้วย (กันแพ็กต่ำ mint key)
    assertPlanAllows(ctx.subscription, "/integrations");
    const name = String(formData.get("name") ?? "").trim() || "API key";

    const count = await one<{ n: number }>(
      "select count(*)::int n from api_keys where org_id=$1 and revoked_at is null",
      [ctx.org!.id],
    );
    if ((count?.n ?? 0) >= 10)
      return { ok: false, error: "มี API key ที่ใช้งานได้ครบ 10 อันแล้ว" };

    const { key, prefix, hash } = generateApiKey();
    await query(
      `insert into api_keys (org_id, name, prefix, key_hash, created_by)
       values ($1,$2,$3,$4,$5)`,
      [ctx.org!.id, name, prefix, hash, ctx.userId],
    );

    await logAudit(ctx.org!.id, ctx.userId, "apikey.create", name);
    revalidatePath("/integrations");
    return { ok: true, key };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** บันทึกการเชื่อมต่อ LINE OA (channel token + ปลายทาง) — ทดสอบส่งจริงก่อนถึงจะบันทึก */
export async function saveLineSettings(formData: FormData): Promise<Result> {
  try {
    const ctx = await requireOwner();
    assertPlanAllows(ctx.subscription, "/integrations");
    const token = String(formData.get("channel_token") ?? "").trim();
    const recipient = String(formData.get("recipient_id") ?? "").trim();
    const notifyLowStock = formData.get("notify_low_stock") === "on";
    if (!token || !recipient)
      return { ok: false, error: "กรอก channel access token และ ID ปลายทางให้ครบ" };

    // ส่งข้อความทดสอบก่อนบันทึก — token/ID ผิดจะได้รู้ตั้งแต่ตอนตั้งค่า ไม่ใช่เงียบหายตอนของใกล้หมด
    await pushLineMessage(
      token,
      recipient,
      `✅ เชื่อมต่อ "${ctx.org!.name}" กับ LINE สำเร็จ — สินค้าใกล้หมดจะแจ้งที่นี่`,
    );

    await query(
      `insert into line_settings (org_id, channel_token, recipient_id, notify_low_stock)
       values ($1,$2,$3,$4)
       on conflict (org_id) do update
         set channel_token=$2, recipient_id=$3, notify_low_stock=$4, updated_at=now()`,
      [ctx.org!.id, token, recipient, notifyLowStock],
    );
    await logAudit(ctx.org!.id, ctx.userId, "integration.line.connect", recipient);
    revalidatePath("/integrations");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** บันทึกการเชื่อมต่อ payment gateway (Omise/Stripe) — ตรวจ key กับ API จริงก่อนถึงจะบันทึก */
export async function saveGatewaySettings(formData: FormData): Promise<Result> {
  try {
    const ctx = await requireOwner();
    assertPlanAllows(ctx.subscription, "/integrations");
    const provider = String(formData.get("provider") ?? "") as GatewayProvider;
    const secretKey = String(formData.get("secret_key") ?? "").trim();
    if (!["omise", "stripe"].includes(provider))
      return { ok: false, error: "เลือกผู้ให้บริการไม่ถูกต้อง" };
    if (!secretKey) return { ok: false, error: "กรอก secret key ก่อน" };

    // key ผิด/หมดสิทธิ์ ให้รู้ตั้งแต่ตอนตั้งค่า — ยิง endpoint อ่านบัญชี ไม่แตะเงิน
    await validateGatewayKey(provider, secretKey);

    await query(
      `insert into payment_gateway_settings (org_id, provider, secret_key)
       values ($1,$2,$3)
       on conflict (org_id) do update set provider=$2, secret_key=$3, updated_at=now()`,
      [ctx.org!.id, provider, secretKey],
    );
    await logAudit(ctx.org!.id, ctx.userId, "integration.gateway.connect", provider);
    revalidatePath("/integrations");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** บันทึกการเชื่อมต่อ SMS (ThaiBulkSMS/Twilio) — ตรวจ credentials กับ API จริงก่อนบันทึก (ไม่เสียเครดิต) */
export async function saveSmsSettings(formData: FormData): Promise<Result> {
  try {
    const ctx = await requireOwner();
    assertPlanAllows(ctx.subscription, "/integrations");
    const provider = String(formData.get("provider") ?? "") as SmsProvider;
    const apiKey = String(formData.get("api_key") ?? "").trim();
    const apiSecret = String(formData.get("api_secret") ?? "").trim();
    const sender = String(formData.get("sender") ?? "").trim() || null;
    if (!["thaibulksms", "twilio"].includes(provider))
      return { ok: false, error: "เลือกผู้ให้บริการไม่ถูกต้อง" };
    if (!apiKey || !apiSecret)
      return { ok: false, error: "กรอก key/secret ให้ครบก่อน" };
    if (provider === "twilio" && !sender)
      return { ok: false, error: "Twilio ต้องระบุเบอร์ From (เช่น +1415xxxxxxx)" };

    await validateSmsCredentials(provider, { apiKey, apiSecret, sender });

    await query(
      `insert into sms_settings (org_id, provider, api_key, api_secret, sender)
       values ($1,$2,$3,$4,$5)
       on conflict (org_id) do update
         set provider=$2, api_key=$3, api_secret=$4, sender=$5, updated_at=now()`,
      [ctx.org!.id, provider, apiKey, apiSecret, sender],
    );
    await logAudit(ctx.org!.id, ctx.userId, "integration.sms.connect", provider);
    revalidatePath("/integrations");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** ยกเลิกการเชื่อมต่อ SMS */
export async function disconnectSms(): Promise<Result> {
  try {
    const ctx = await requireOwner();
    await query("delete from sms_settings where org_id=$1", [ctx.org!.id]);
    await logAudit(ctx.org!.id, ctx.userId, "integration.sms.disconnect");
    revalidatePath("/integrations");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** ยกเลิกการเชื่อมต่อ payment gateway */
export async function disconnectGateway(): Promise<Result> {
  try {
    const ctx = await requireOwner();
    await query("delete from payment_gateway_settings where org_id=$1", [ctx.org!.id]);
    await logAudit(ctx.org!.id, ctx.userId, "integration.gateway.disconnect");
    revalidatePath("/integrations");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** ยกเลิกการเชื่อมต่อ LINE */
export async function disconnectLine(): Promise<Result> {
  try {
    const ctx = await requireOwner();
    await query("delete from line_settings where org_id=$1", [ctx.org!.id]);
    await logAudit(ctx.org!.id, ctx.userId, "integration.line.disconnect");
    revalidatePath("/integrations");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * ส่งออกยอดขายเป็น CSV สำหรับนำเข้าโปรแกรมบัญชี (FlowAccount/PEAK รองรับนำเข้า CSV)
 * คืนเนื้อไฟล์เป็น string — ฝั่ง client ทำเป็นไฟล์ดาวน์โหลดเอง (ช่วงวันที่จำกัด ≤ 366 วัน)
 */
export async function exportSalesCsv(
  from: string,
  to: string,
): Promise<Result & { csv?: string; rows?: number }> {
  try {
    const ctx = await requireOwner();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
      return { ok: false, error: "รูปแบบวันที่ไม่ถูกต้อง" };
    const days = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
    if (days < 0) return { ok: false, error: "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม" };
    if (days > 366) return { ok: false, error: "เลือกช่วงได้ไม่เกิน 1 ปี" };

    const rows = await query<{
      created_at: string;
      bill_no: string;
      subtotal: number;
      discount: number;
      total: number;
      payment_method: string;
      branch_name: string | null;
      customer_name: string | null;
    }>(
      `select s.created_at, s.bill_no, s.subtotal, s.discount, s.total, s.payment_method,
              b.name as branch_name, c.name as customer_name
         from sales s
         left join branches b on b.id = s.branch_id
         left join customers c on c.id = s.customer_id
        where s.org_id = $1
          and s.created_at >= $2::date
          and s.created_at < ($3::date + interval '1 day')
        order by s.created_at`,
      [ctx.org!.id, from, to],
    );

    // escape ตามมาตรฐาน CSV — ครอบ quote เมื่อมี comma/quote/ขึ้นบรรทัด
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = "วันที่,เลขที่บิล,ยอดก่อนส่วนลด,ส่วนลด,ยอดสุทธิ,วิธีชำระ,สาขา,ลูกค้า";
    const lines = rows.map((r) =>
      [
        new Date(r.created_at).toISOString().slice(0, 19).replace("T", " "),
        r.bill_no,
        Number(r.subtotal).toFixed(2),
        Number(r.discount).toFixed(2),
        Number(r.total).toFixed(2),
        r.payment_method,
        r.branch_name ?? "",
        r.customer_name ?? "",
      ]
        .map(esc)
        .join(","),
    );
    // BOM นำหน้าให้ Excel/โปรแกรมบัญชีอ่านไทย (UTF-8) ถูก
    const csv = "\uFEFF" + [header, ...lines].join("\r\n");

    await logAudit(ctx.org!.id, ctx.userId, "export.sales", `${from} ถึง ${to} (${rows.length} บิล)`);
    return { ok: true, csv, rows: rows.length };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** ยกเลิก API key */
export async function revokeApiKey(id: string): Promise<Result> {
  try {
    const ctx = await requireOwner();
    await query(
      "update api_keys set revoked_at=now() where id=$1 and org_id=$2 and revoked_at is null",
      [id, ctx.org!.id],
    );
    await logAudit(ctx.org!.id, ctx.userId, "apikey.revoke", id);
    revalidatePath("/integrations");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
