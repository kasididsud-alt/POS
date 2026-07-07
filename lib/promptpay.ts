import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

/**
 * สร้าง data-URL ของ PromptPay QR
 * @param target เบอร์มือถือ / เลขบัตรประชาชน / เลขนิติบุคคล (พร้อมเพย์ของร้าน)
 * @param amount จำนวนเงิน (บาท) — ใส่เพื่อทำ QR แบบระบุยอด
 */
export async function makePromptPayQR(
  target: string,
  amount: number,
): Promise<string> {
  const sanitized = target.replace(/[^0-9]/g, "");
  const payload = generatePayload(sanitized, { amount });
  return QRCode.toDataURL(payload, { width: 320, margin: 1 });
}
