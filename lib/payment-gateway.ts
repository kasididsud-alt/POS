/**
 * Payment gateway ของร้าน (Omise/Stripe) — pure client, ไม่แตะ DB
 * ร้านผูก secret key ของบัญชีตัวเองใน /integrations แล้วใช้สร้างลิงก์ชำระเงิน
 * (คนละบัญชีกับ Stripe ของระบบ billing แพ็กเกจ — ห้ามปนกัน)
 */
export type GatewayProvider = "omise" | "stripe";

export const PROVIDER_LABEL: Record<GatewayProvider, string> = {
  omise: "Omise (Opn Payments)",
  stripe: "Stripe",
};

function timeout() {
  return AbortSignal.timeout(10_000);
}

async function readError(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  return `${res.status}: ${body.slice(0, 300)}`;
}

/**
 * ตรวจว่า secret key ใช้ได้จริง — ยิง endpoint อ่านข้อมูลบัญชี (ไม่สร้าง/ไม่ขยับเงิน)
 * โยน Error พร้อมรายละเอียดถ้า key ใช้ไม่ได้
 */
export async function validateGatewayKey(
  provider: GatewayProvider,
  secretKey: string,
): Promise<void> {
  const res =
    provider === "stripe"
      ? await fetch("https://api.stripe.com/v1/balance", {
          headers: { Authorization: `Bearer ${secretKey}` },
          signal: timeout(),
        })
      : await fetch("https://api.omise.co/account", {
          headers: {
            Authorization: `Basic ${Buffer.from(secretKey + ":").toString("base64")}`,
          },
          signal: timeout(),
        });
  if (!res.ok) throw new Error(`ตรวจ key ไม่ผ่าน (${await readError(res)})`);
}

/**
 * สร้างลิงก์ชำระเงินสำหรับยอดหนึ่งก้อน — คืน URL ให้ส่งลูกค้า
 * amountSatang = ยอดเป็นสตางค์ (บาท × 100, จำนวนเต็ม)
 */
export async function createPaymentLink(
  provider: GatewayProvider,
  secretKey: string,
  input: { amountSatang: number; description: string },
): Promise<string> {
  if (!Number.isInteger(input.amountSatang) || input.amountSatang < 2000)
    throw new Error("ยอดต่ำกว่าขั้นต่ำของ gateway (20 บาท)");

  if (provider === "stripe") {
    // Stripe: checkout session แบบ price_data — จบใน request เดียว ไม่ต้องสร้าง product ค้างไว้
    const params = new URLSearchParams({
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "thb",
      "line_items[0][price_data][unit_amount]": String(input.amountSatang),
      "line_items[0][price_data][product_data][name]": input.description,
      // ลูกค้าจ่ายเสร็จเห็นหน้า success กลางของ Stripe ได้เลย ไม่ต้องมีเว็บ callback
      success_url: "https://checkout.stripe.com/success",
    });
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      signal: timeout(),
    });
    if (!res.ok) throw new Error(`สร้างลิงก์ไม่สำเร็จ (${await readError(res)})`);
    const data = (await res.json()) as { url?: string };
    if (!data.url) throw new Error("Stripe ไม่คืน URL ของลิงก์ชำระเงิน");
    return data.url;
  }

  // Omise: payment link ผ่าน Link API
  const params = new URLSearchParams({
    amount: String(input.amountSatang),
    currency: "thb",
    title: input.description,
    description: input.description,
  });
  const res = await fetch("https://api.omise.co/links", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(secretKey + ":").toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    signal: timeout(),
  });
  if (!res.ok) throw new Error(`สร้างลิงก์ไม่สำเร็จ (${await readError(res)})`);
  const data = (await res.json()) as { payment_uri?: string };
  if (!data.payment_uri) throw new Error("Omise ไม่คืน URL ของลิงก์ชำระเงิน");
  return data.payment_uri;
}

// ---------- พร้อมเพย์ผ่าน gateway ที่หน้า POS ----------
// สร้าง charge พร้อม QR แล้วให้ฝั่ง POS poll ถามสถานะจนเงินเข้า (ไม่ต้องมี webhook)

export type GatewayCharge = {
  /** id ของ charge (Omise: chrg_xxx) / payment intent (Stripe: pi_xxx) — ใช้ poll สถานะต่อ */
  chargeId: string;
  /** URL รูป QR ให้ลูกค้าสแกน */
  qrImage: string;
};

export type ChargeStatus = "pending" | "paid" | "failed";

/** สร้างรายการรับเงินพร้อมเพย์ผ่าน gateway — คืน QR + charge id ไว้ poll */
export async function createPromptPayCharge(
  provider: GatewayProvider,
  secretKey: string,
  input: { amountSatang: number; description: string },
): Promise<GatewayCharge> {
  if (!Number.isInteger(input.amountSatang) || input.amountSatang < 2000)
    throw new Error("ยอดต่ำกว่าขั้นต่ำของ gateway (20 บาท)");

  if (provider === "stripe") {
    // payment intent แบบ confirm ทันที → ได้ QR ใน next_action
    const params = new URLSearchParams({
      amount: String(input.amountSatang),
      currency: "thb",
      description: input.description,
      confirm: "true",
      "payment_method_types[]": "promptpay",
      "payment_method_data[type]": "promptpay",
    });
    const res = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      signal: timeout(),
    });
    if (!res.ok) throw new Error(`สร้าง QR ไม่สำเร็จ (${await readError(res)})`);
    const data = (await res.json()) as {
      id?: string;
      next_action?: { promptpay_display_qr_code?: { image_url_png?: string } };
    };
    const qr = data.next_action?.promptpay_display_qr_code?.image_url_png;
    if (!data.id || !qr)
      throw new Error(
        "Stripe ไม่คืน QR — ตรวจว่าเปิดรับ PromptPay ใน Stripe dashboard แล้ว",
      );
    return { chargeId: data.id, qrImage: qr };
  }

  // Omise: charge + source promptpay ในคำขอเดียว
  const params = new URLSearchParams({
    amount: String(input.amountSatang),
    currency: "thb",
    description: input.description,
    "source[type]": "promptpay",
  });
  const res = await fetch("https://api.omise.co/charges", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(secretKey + ":").toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    signal: timeout(),
  });
  if (!res.ok) throw new Error(`สร้าง QR ไม่สำเร็จ (${await readError(res)})`);
  const data = (await res.json()) as {
    id?: string;
    source?: { scannable_code?: { image?: { download_uri?: string } } };
  };
  const qr = data.source?.scannable_code?.image?.download_uri;
  if (!data.id || !qr)
    throw new Error("Omise ไม่คืน QR — ตรวจว่าบัญชีเปิดรับ PromptPay แล้ว");
  return { chargeId: data.id, qrImage: qr };
}

/** ถามสถานะรายการรับเงิน — POS ใช้ poll ทุก 2-3 วิ จนกว่าจะ paid/failed */
export async function getChargeStatus(
  provider: GatewayProvider,
  secretKey: string,
  chargeId: string,
): Promise<ChargeStatus> {
  if (provider === "stripe") {
    const res = await fetch(
      `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(chargeId)}`,
      { headers: { Authorization: `Bearer ${secretKey}` }, signal: timeout() },
    );
    if (!res.ok) throw new Error(`เช็คสถานะไม่สำเร็จ (${await readError(res)})`);
    const data = (await res.json()) as { status?: string };
    if (data.status === "succeeded") return "paid";
    if (data.status === "canceled") return "failed";
    return "pending";
  }

  const res = await fetch(
    `https://api.omise.co/charges/${encodeURIComponent(chargeId)}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(secretKey + ":").toString("base64")}`,
      },
      signal: timeout(),
    },
  );
  if (!res.ok) throw new Error(`เช็คสถานะไม่สำเร็จ (${await readError(res)})`);
  const data = (await res.json()) as { status?: string; paid?: boolean };
  if (data.status === "successful" || data.paid) return "paid";
  if (data.status === "failed" || data.status === "expired") return "failed";
  return "pending";
}
