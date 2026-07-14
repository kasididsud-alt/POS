"use server";

import { revalidatePath } from "next/cache";
import { query, one } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { assertPlanAllows, assertRoleAtLeast } from "@/lib/limits";
import { createPaymentLink, type GatewayProvider } from "@/lib/payment-gateway";
import { sendSms, type SmsProvider } from "@/lib/sms";
import { logAudit } from "@/lib/audit";

type Result = { ok: boolean; error?: string };
type SOLine = { product_id: string; name: string; unit_price: number; qty: number };

export async function createSalesOrder(input: {
  customer_id: string | null;
  note: string | null;
  items: SOLine[];
}): Promise<Result> {
  try {
    const ctx = await getAppContext();
    if (!ctx?.org) throw new Error("unauthorized");
    // ออเดอร์ขายส่ง = ฟีเจอร์แพ็ก Pro — บังคับที่ action ด้วย (layout gate ทำงานแค่ตอน render)
    assertPlanAllows(ctx.subscription, "/sales-orders");
    // ออเดอร์ขายส่งมูลค่าสูง — ผู้จัดการขึ้นไป
    assertRoleAtLeast(ctx.membership?.role, "manager");
    const items = (input.items ?? []).filter((i) => i.product_id && i.qty > 0);
    if (!items.length) return { ok: false, error: "เพิ่มรายการอย่างน้อย 1" };

    await query("select create_sales_order($1,$2,$3::jsonb,$4,$5)", [
      ctx.org.id,
      input.customer_id || null,
      JSON.stringify(items),
      input.note || null,
      ctx.userId,
    ]);
    await logAudit(ctx.org.id, ctx.userId, "so.create", `${items.length} รายการ`);
    revalidatePath("/sales-orders");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function setSOStatus(id: string, status: string): Promise<Result> {
  try {
    // ไม่ gate แพ็กตรงเปลี่ยนสถานะ — ออเดอร์ค้าง (สร้างตอนยังเป็น Pro) ต้องปิด/ยกเลิกได้หลังดาวน์เกรด
    // (สร้างออเดอร์ใหม่ถูก gate อยู่แล้ว)
    const ctx = await getAppContext();
    if (!ctx?.org) throw new Error("unauthorized");
    // เปลี่ยนสถานะออเดอร์ (ยืนยัน/ยกเลิก) — ผู้จัดการขึ้นไป (แพ็กไม่ gate ตรงนี้ แต่บทบาทต้อง gate)
    assertRoleAtLeast(ctx.membership?.role, "manager");
    // "ส่งมอบ" ต้องผ่าน fulfillSalesOrder เท่านั้น (มีการตัดสต็อก) — ห้ามเซ็ตสถานะตรง
    if (!["open", "confirmed", "cancelled"].includes(status))
      return { ok: false, error: "สถานะไม่ถูกต้อง" };
    // ออเดอร์ที่ส่งมอบแล้วตัดสต็อกไปแล้ว — ห้ามย้อนสถานะ (ไม่งั้นสต็อกกับสถานะไม่ตรงกัน)
    await query(
      "update sales_orders set status=$1 where id=$2 and org_id=$3 and status <> 'fulfilled'",
      [status, id, ctx.org.id],
    );
    await logAudit(ctx.org.id, ctx.userId, "so.status", `${id} → ${status}`);
    revalidatePath("/sales-orders");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * สร้างลิงก์ชำระเงินของออเดอร์ผ่าน gateway ที่ร้านผูกไว้ (Omise/Stripe) — คืน URL ให้ส่งลูกค้า
 * ลิงก์คือ "ช่องทางจ่าย" เฉยๆ ยังไม่เปลี่ยนสถานะออเดอร์ — เงินเข้าแล้วร้านไปกดยืนยันเอง
 */
export async function createSOPaymentLink(
  id: string,
): Promise<Result & { url?: string }> {
  try {
    const ctx = await getAppContext();
    if (!ctx?.org) throw new Error("unauthorized");
    assertRoleAtLeast(ctx.membership?.role, "manager");

    const so = await one<{ so_no: string; total: number; status: string }>(
      "select so_no, total, status from sales_orders where id=$1 and org_id=$2",
      [id, ctx.org.id],
    );
    if (!so) return { ok: false, error: "ไม่พบออเดอร์" };
    if (so.status === "cancelled")
      return { ok: false, error: "ออเดอร์ถูกยกเลิกแล้ว" };

    const gw = await one<{ provider: GatewayProvider; secret_key: string }>(
      "select provider, secret_key from payment_gateway_settings where org_id=$1",
      [ctx.org.id],
    );
    if (!gw)
      return {
        ok: false,
        error: "ยังไม่ได้เชื่อมต่อ Omise/Stripe — ตั้งค่าที่หน้า การเชื่อมต่อ ก่อน",
      };

    const url = await createPaymentLink(gw.provider, gw.secret_key, {
      amountSatang: Math.round(Number(so.total) * 100),
      description: `ออเดอร์ ${so.so_no} — ${ctx.org.name}`,
    });
    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const SO_STATUS_SMS: Record<string, string> = {
  open: "รับออเดอร์แล้ว กำลังจัดเตรียมสินค้า",
  confirmed: "ยืนยันออเดอร์แล้ว กำลังจัดเตรียมสินค้า",
  fulfilled: "จัดส่ง/ส่งมอบสินค้าแล้ว",
};

/** ส่ง SMS แจ้งสถานะออเดอร์ไปที่เบอร์ลูกค้าของออเดอร์ — กดส่งเองต่อครั้ง (SMS มีค่าส่ง ไม่ยิงอัตโนมัติ) */
export async function sendSOStatusSms(id: string): Promise<Result> {
  try {
    const ctx = await getAppContext();
    if (!ctx?.org) throw new Error("unauthorized");
    assertRoleAtLeast(ctx.membership?.role, "manager");

    const so = await one<{
      so_no: string;
      total: number;
      status: string;
      phone: string | null;
    }>(
      `select so.so_no, so.total, so.status, c.phone
         from sales_orders so left join customers c on c.id = so.customer_id
        where so.id=$1 and so.org_id=$2`,
      [id, ctx.org.id],
    );
    if (!so) return { ok: false, error: "ไม่พบออเดอร์" };
    if (!so.phone)
      return { ok: false, error: "ออเดอร์นี้ไม่มีเบอร์ลูกค้า — เพิ่มเบอร์ในหน้าลูกค้าก่อน" };
    const statusText = SO_STATUS_SMS[so.status];
    if (!statusText) return { ok: false, error: "สถานะนี้ไม่มีข้อความแจ้ง (ยกเลิกแล้ว)" };

    const sms = await one<{
      provider: SmsProvider;
      api_key: string;
      api_secret: string;
      sender: string | null;
    }>(
      "select provider, api_key, api_secret, sender from sms_settings where org_id=$1",
      [ctx.org.id],
    );
    if (!sms)
      return { ok: false, error: "ยังไม่ได้เชื่อมต่อ SMS — ตั้งค่าที่หน้า การเชื่อมต่อ ก่อน" };

    await sendSms(
      sms.provider,
      { apiKey: sms.api_key, apiSecret: sms.api_secret, sender: sms.sender },
      {
        to: so.phone,
        message: `${ctx.org.name}: ออเดอร์ ${so.so_no} ${statusText} (ยอด ${Number(so.total).toLocaleString("th-TH")} บาท)`,
      },
    );
    await logAudit(ctx.org.id, ctx.userId, "so.sms", `${so.so_no} → ${so.phone}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** ส่งมอบออเดอร์ + ตัดสต็อกจริงจากสาขาปัจจุบัน (atomic — กดซ้ำไม่ตัดซ้ำ) */
export async function fulfillSalesOrder(id: string): Promise<Result> {
  try {
    const ctx = await getAppContext();
    if (!ctx?.org) throw new Error("unauthorized");
    assertRoleAtLeast(ctx.membership?.role, "manager");
    if (!ctx.branchId) return { ok: false, error: "ไม่พบสาขาปัจจุบัน" };

    await query("select fulfill_sales_order($1,$2,$3,$4)", [
      ctx.org.id,
      id,
      ctx.userId,
      ctx.branchId,
    ]);
    await logAudit(ctx.org.id, ctx.userId, "so.fulfill", `SO ${id}`);
    revalidatePath("/sales-orders");
    revalidatePath("/stock");
    revalidatePath("/products");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
