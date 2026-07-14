import { query } from "./db";
import { pushLineMessage } from "./line-api";

export { pushLineMessage };

/** ชั่วโมงคูลดาวน์ต่อสินค้า — กันบิลติดๆ กันยิงแจ้งเตือนซ้ำทุกบิล */
const ALERT_COOLDOWN_HOURS = 24;

/**
 * หลังการขาย: เช็คว่าสินค้าที่เพิ่งขายตัวไหน "ใกล้หมด" (qty ≤ threshold ของสาขาที่ขาย)
 * แล้ว push แจ้งเข้า LINE ของร้าน — เรียกจาก after() เท่านั้น ห้าม await ใน hot path ของ POS
 *
 * ออกแบบให้พังเงียบ: LINE ล่ม/token ผิด ต้องไม่กระทบการขาย (log ไว้อย่างเดียว)
 */
export async function notifyLowStockAfterSale(
  orgId: string,
  branchId: string | null,
  productIds: string[],
): Promise<void> {
  if (!productIds.length) return;
  try {
    const settings = await query<{
      channel_token: string;
      recipient_id: string;
    }>(
      `select channel_token, recipient_id from line_settings
        where org_id = $1 and notify_low_stock = true`,
      [orgId],
    );
    if (!settings.length) return;

    // เฉพาะสินค้าที่ (1) เพิ่งขาย (2) ตอนนี้ใกล้หมด (3) พ้นคูลดาวน์แล้ว
    // จองสิทธิ์แจ้งด้วย upsert ในคำสั่งเดียว — บิลที่ยิงพร้อมกันจะมีแค่แถวที่ upsert สำเร็จได้สิทธิ์
    const low = await query<{ id: string; name: string; qty: number; threshold: number }>(
      `with low as (
         select p.id, p.name, coalesce(ps.qty, 0)::numeric as qty, p.low_stock_threshold as threshold
           from products p
           left join product_stock ps on ps.product_id = p.id and ps.branch_id = $2
          where p.org_id = $1 and p.id = any($3::uuid[])
            and p.is_active = true
            and coalesce(ps.qty, 0) <= p.low_stock_threshold
       ),
       claimed as (
         insert into line_alert_log (org_id, product_id)
         select $1, id from low
         on conflict (org_id, product_id) do update set sent_at = now()
           where line_alert_log.sent_at < now() - interval '${ALERT_COOLDOWN_HOURS} hours'
         returning product_id
       )
       select l.* from low l join claimed c on c.product_id = l.id`,
      [orgId, branchId, productIds],
    );
    if (!low.length) return;

    const lines = low.map(
      (p) => `• ${p.name} เหลือ ${Number(p.qty).toLocaleString("th-TH")} (จุดเตือน ${Number(p.threshold).toLocaleString("th-TH")})`,
    );
    const text = `⚠️ สินค้าใกล้หมด\n${lines.join("\n")}\n\nเปิดดู/สั่งเพิ่ม: ${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3020"}/alerts`;

    await pushLineMessage(settings[0]!.channel_token, settings[0]!.recipient_id, text);
  } catch (e) {
    console.error("[line] low-stock notify failed:", (e as Error).message);
  }
}
