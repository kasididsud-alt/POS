"use server";

import { revalidatePath } from "next/cache";
import { one } from "@/lib/db";
import { getAppContext, isSubscriptionActive } from "@/lib/auth";
import { makePromptPayQR } from "@/lib/promptpay";
import type { CartLine, PaymentMethod } from "@/lib/types";

export type CheckoutInput = {
  items: CartLine[];
  payment_method: PaymentMethod;
  discount: number;
  cash_received: number | null;
  customer_id?: string | null;
};

export type CheckoutResult = {
  ok: boolean;
  error?: string;
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
      checkout_sale: { bill_no: string; total: number; change: number; points: number };
    }>(
      "select checkout_sale($1, $2::jsonb, $3, $4, $5, $6, $7, $8) as checkout_sale",
      [
        ctx.org.id,
        JSON.stringify(input.items),
        input.payment_method,
        input.discount,
        input.cash_received,
        ctx.userId,
        input.customer_id ?? null,
        ctx.branchId,
      ],
    );

    revalidatePath("/products");
    revalidatePath("/dashboard");
    revalidatePath("/sales");
    revalidatePath("/receivables");
    revalidatePath("/customers");

    const r = row!.checkout_sale;
    return {
      ok: true,
      bill_no: r.bill_no,
      total: r.total,
      change: r.change,
      points: r.points,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** สร้าง PromptPay QR (data URL) จากเบอร์พร้อมเพย์ของร้าน */
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
