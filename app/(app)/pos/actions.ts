"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { one, query } from "@/lib/db";
import { getAppContext, isSubscriptionActive } from "@/lib/auth";
import { notifyDisplay } from "@/lib/display-events";
import { notifyLowStockAfterSale } from "@/lib/line";
import { logAudit } from "@/lib/audit";
import {
  createPromptPayCharge,
  getChargeStatus,
  type ChargeStatus,
  type GatewayProvider,
} from "@/lib/payment-gateway";
import { makePromptPayQR } from "@/lib/promptpay";
import type { PaymentMethod } from "@/lib/types";

// ส่งแค่ product_id + qty — ราคาอ่านจาก DB ฝั่ง server (กัน client แก้ราคา)
export type CheckoutItem = { product_id: string; qty: number };

export type CheckoutInput = {
  items: CheckoutItem[];
  payment_method: PaymentMethod;
  discount: number;
  cash_received: number | null;
  customer_id?: string | null;
};

export type CheckoutResult = {
  ok: boolean;
  error?: string;
  sale_id?: string;
  bill_no?: string;
  total?: number;
  change?: number;
  points?: number;
};

export async function checkoutAction(
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const ctx = await getAppContext();
  if (!ctx?.org) return { ok: false, error: "unauthorized" };

  if (!isSubscriptionActive(ctx.subscription)) {
    return {
      ok: false,
      error: "การทดลองใช้หมดอายุ — กรุณาเลือกแพ็กเกจในหน้าตั้งค่า",
    };
  }
  if (!input.items.length) return { ok: false, error: "ตะกร้าว่าง" };

  try {
    const row = await one<{
      checkout_sale: {
        sale_id: string;
        bill_no: string;
        total: number;
        change: number;
        points: number;
      };
    }>(
      "select checkout_sale($1, $2::jsonb, $3, $4, $5, $6, $7, $8) as checkout_sale",
      [
        ctx.org.id,
        // ส่งเฉพาะ field ที่ RPC ใช้ — ตัด field แปลกปลอมจาก client ทิ้ง
        JSON.stringify(
          input.items.map(({ product_id, qty }) => ({ product_id, qty })),
        ),
        input.payment_method,
        input.discount,
        input.cash_received,
        ctx.userId,
        input.customer_id ?? null,
        ctx.branchId,
      ],
    );

    revalidatePath("/pos");
    revalidatePath("/products");
    revalidatePath("/dashboard");
    revalidatePath("/sales");
    revalidatePath("/receivables");
    revalidatePath("/customers");

    // แจ้ง LINE ถ้าของที่ขายไปตัวไหนใกล้หมด + จด audit — หลังส่ง response แล้ว ไม่หน่วงหน้าจอขาย
    const orgId = ctx.org.id;
    const branchId = ctx.branchId;
    const userId = ctx.userId;
    const soldIds = input.items.map((i) => i.product_id);
    const r0 = row!.checkout_sale;
    after(() => notifyLowStockAfterSale(orgId, branchId, soldIds));
    after(() =>
      logAudit(orgId, userId, "sale.checkout", `${r0.bill_no} ยอด ${r0.total} (${input.payment_method})`),
    );

    const r = row!.checkout_sale;
    return {
      ok: true,
      sale_id: r.sale_id,
      bill_no: r.bill_no,
      total: r.total,
      change: r.change,
      points: r.points,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/* ---------- จอลูกค้า (Customer Display) ----------
   จออีกเครื่องเปิด /pos-display → ได้รหัส 6 หลัก → แคชเชียร์กรอกรหัสเพื่อจับคู่
   จากนั้นแคชเชียร์ push สถานะ (ตะกร้า/QR/จ่ายแล้ว) ฝั่งจอ poll อ่านทาง /api/pos/display */

export type DisplayState =
  | { mode: "idle" }
  | {
      mode: "cart";
      items: {
        name: string;
        /** ราคาต่อหน่วย */
        price: number;
        qty: number;
        /** หน่วยนับ เช่น ชิ้น/ขวด */
        unit: string;
        /** ราคารวมของแถว (price × qty) */
        total: number;
      }[];
      subtotal: number;
      discount: number;
      total: number;
      /** ชื่อลูกค้าที่เลือก (null = ลูกค้าทั่วไป) */
      customer: string | null;
      /** QR พร้อมเพย์ (data URL) — มีเฉพาะตอนเปิดรับชำระพร้อมเพย์ */
      qr: string | null;
    }
  | { mode: "paid"; total: number; change: number; method: string; points: number };

/** ฝั่งจอลูกค้า: สร้าง session ใหม่ พร้อมรหัสจับคู่ */
export async function createDisplaySessionAction(): Promise<{
  ok: boolean;
  error?: string;
  id?: string;
  code?: string;
}> {
  const ctx = await getAppContext();
  if (!ctx?.org) return { ok: false, error: "unauthorized" };

  try {
    // เก็บกวาด session ที่ไม่เคยถูกจับคู่และค้างเกิน 2 วัน กันแถวพอกใน org
    await query(
      `delete from customer_displays
        where org_id = $1 and paired = false and created_at < now() - interval '2 days'`,
      [ctx.org.id],
    );
    const code = String(randomInt(0, 1000000)).padStart(6, "0");
    const row = await one<{ id: string }>(
      `insert into customer_displays (org_id, branch_id, pair_code)
       values ($1, $2, $3) returning id`,
      [ctx.org.id, ctx.branchId, code],
    );
    return { ok: true, id: row!.id, code };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** ฝั่งแคชเชียร์: จับคู่ด้วยรหัสจากจอลูกค้า (รหัสมีอายุ 30 นาที) */
export async function pairDisplayAction(
  code: string,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const ctx = await getAppContext();
  if (!ctx?.org) return { ok: false, error: "unauthorized" };

  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) return { ok: false, error: "รหัสต้องเป็นตัวเลข 6 หลัก" };

  try {
    const row = await one<{ id: string }>(
      `update customer_displays set paired = true, updated_at = now()
        where id = (
          select id from customer_displays
           where org_id = $1 and pair_code = $2
             and created_at > now() - interval '30 minutes'
           order by created_at desc limit 1
        )
        returning id`,
      [ctx.org.id, trimmed],
    );
    if (!row) return { ok: false, error: "ไม่พบรหัสนี้ — เช็ครหัสบนจอลูกค้า (รหัสมีอายุ 30 นาที)" };
    await notifyDisplay(row.id); // จอเด้งเป็น "เชื่อมต่อแล้ว" ทันที
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** ฝั่งแคชเชียร์: ส่งสถานะล่าสุดไปให้จอลูกค้า */
export async function pushDisplayStateAction(
  id: string,
  state: DisplayState,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getAppContext();
  if (!ctx?.org) return { ok: false, error: "unauthorized" };

  // ทำความสะอาด payload ฝั่ง server — รับเฉพาะ field ที่รู้จัก + จำกัดขนาด
  let clean: DisplayState;
  if (state.mode === "cart") {
    // QR ต้องเป็น data URL รูปภาพขนาดไม่เกินเพดาน — ไม่ผ่านเงื่อนไขให้ตัดทิ้ง (แสดงกล่องว่างแทน)
    const qr =
      typeof state.qr === "string" &&
      state.qr.startsWith("data:image/") &&
      state.qr.length <= 200000
        ? state.qr
        : null;
    clean = {
      mode: "cart",
      items: (state.items ?? []).slice(0, 100).map((i) => ({
        name: String(i.name).slice(0, 80),
        price: Number(i.price) || 0,
        qty: Number(i.qty) || 0,
        unit: String(i.unit ?? "").slice(0, 20),
        total: Number(i.total) || 0,
      })),
      subtotal: Number(state.subtotal) || 0,
      discount: Number(state.discount) || 0,
      total: Number(state.total) || 0,
      customer: state.customer ? String(state.customer).slice(0, 60) : null,
      qr,
    };
  } else if (state.mode === "paid") {
    clean = {
      mode: "paid",
      total: Number(state.total) || 0,
      change: Number(state.change) || 0,
      method: String(state.method).slice(0, 30),
      points: Number(state.points) || 0,
    };
  } else {
    clean = { mode: "idle" };
  }

  try {
    const row = await one<{ id: string }>(
      `update customer_displays set state = $3::jsonb, updated_at = now()
        where id = $1 and org_id = $2 and paired = true
        returning id`,
      [id, ctx.org.id, JSON.stringify(clean)],
    );
    if (!row) return { ok: false, error: "not_found" };
    await notifyDisplay(id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** ยกเลิกการจับคู่ (ใช้ได้ทั้งสองฝั่ง) — จอกลับไปสถานะรอจับคู่ */
export async function unpairDisplayAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getAppContext();
  if (!ctx?.org) return { ok: false, error: "unauthorized" };
  try {
    await query(
      `update customer_displays
          set paired = false, state = '{"mode":"idle"}'::jsonb, updated_at = now()
        where id = $1 and org_id = $2`,
      [id, ctx.org.id],
    );
    await notifyDisplay(id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** สร้าง PromptPay QR (data URL) จากเบอร์พร้อมเพย์ของร้าน */
/**
 * สร้าง QR พร้อมเพย์ผ่าน gateway ของร้านตามยอดบิลปัจจุบัน — คืน chargeId ไว้ poll สถานะ
 * ยอดคิดฝั่ง server จากราคาใน DB (ส่งแค่ product_id+qty มาเหมือน checkout) กัน client แก้ยอด
 */
export async function createGatewayQRAction(input: {
  items: CheckoutItem[];
  discount: number;
}): Promise<{
  ok: boolean;
  chargeId?: string;
  qrImage?: string;
  amount?: number;
  error?: string;
}> {
  const ctx = await getAppContext();
  if (!ctx?.org) return { ok: false, error: "unauthorized" };
  if (!isSubscriptionActive(ctx.subscription))
    return { ok: false, error: "การทดลองใช้หมดอายุ — กรุณาเลือกแพ็กเกจในหน้าตั้งค่า" };

  const items = (input.items ?? []).filter((i) => i.product_id && i.qty > 0);
  if (!items.length) return { ok: false, error: "ตะกร้าว่าง" };

  try {
    const gw = await one<{ provider: GatewayProvider; secret_key: string }>(
      "select provider, secret_key from payment_gateway_settings where org_id=$1",
      [ctx.org.id],
    );
    if (!gw)
      return { ok: false, error: "ยังไม่ได้เชื่อมต่อ Omise/Stripe ที่หน้า การเชื่อมต่อ" };

    // ยอดจากราคาจริงใน DB — สูตรเดียวกับ checkout_sale (ราคา × จำนวน − ส่วนลด, ไม่ติดลบ)
    const rows = await query<{ id: string; price: number }>(
      "select id, price from products where org_id=$1 and id = any($2::uuid[]) and is_active",
      [ctx.org.id, items.map((i) => i.product_id)],
    );
    const priceById = new Map(rows.map((r) => [r.id, Number(r.price)]));
    let subtotal = 0;
    for (const i of items) {
      const price = priceById.get(i.product_id);
      if (price === undefined) return { ok: false, error: "มีสินค้าที่ไม่พบในระบบ" };
      subtotal += price * i.qty;
    }
    const total = Math.max(subtotal - Math.max(Number(input.discount) || 0, 0), 0);
    const amountSatang = Math.round(total * 100);

    const charge = await createPromptPayCharge(gw.provider, gw.secret_key, {
      amountSatang,
      description: `POS ${ctx.org.name}`,
    });
    return { ok: true, chargeId: charge.chargeId, qrImage: charge.qrImage, amount: total };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** ถามสถานะการจ่ายของ QR ที่สร้างไว้ — POS poll ทุก 2-3 วิ */
export async function checkGatewayChargeAction(
  chargeId: string,
): Promise<{ ok: boolean; status?: ChargeStatus; error?: string }> {
  const ctx = await getAppContext();
  if (!ctx?.org) return { ok: false, error: "unauthorized" };
  try {
    const gw = await one<{ provider: GatewayProvider; secret_key: string }>(
      "select provider, secret_key from payment_gateway_settings where org_id=$1",
      [ctx.org.id],
    );
    if (!gw) return { ok: false, error: "ยังไม่ได้เชื่อมต่อ gateway" };
    const status = await getChargeStatus(gw.provider, gw.secret_key, chargeId);
    return { ok: true, status };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function getPromptPayQRAction(
  amount: number,
): Promise<{ ok: boolean; dataUrl?: string; error?: string }> {
  const ctx = await getAppContext();
  if (!ctx?.org) return { ok: false, error: "unauthorized" };
  if (!ctx.org.promptpay_id) {
    return { ok: false, error: "ยังไม่ได้ตั้งค่าเบอร์พร้อมเพย์ในหน้าตั้งค่า" };
  }
  try {
    const dataUrl = await makePromptPayQR(ctx.org.promptpay_id, amount);
    return { ok: true, dataUrl };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
