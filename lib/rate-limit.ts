// Rate limiter แบบ fixed-window ในหน่วยความจำ (abuse backstop สำหรับ deploy แบบ single-instance)
// หมายเหตุ: state อยู่ใน process เดียว — พอสำหรับร้าน SME ที่รันเซิร์ฟเวอร์เดียว
// ถ้าสเกลหลาย instance ต้องย้ายไป Redis/Upstash (คงสัญญา rateLimit() เดิมได้)

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateResult = { ok: boolean; remaining: number; resetAt: number };

/**
 * นับ 1 ครั้งต่อการเรียก แล้วบอกว่าเกินลิมิตในหน้าต่างเวลานี้หรือยัง
 * @param key   คีย์ระบุผู้ใช้/เซสชัน
 * @param limit จำนวนคำขอสูงสุดต่อหน้าต่าง
 * @param windowMs ความยาวหน้าต่าง (ค่าเริ่มต้น 60 วินาที)
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs = 60_000,
): RateResult {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;

  // เก็บกวาด bucket ที่หมดอายุแบบ opportunistic กันหน่วยความจำบวม
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }

  return {
    ok: b.count <= limit,
    remaining: Math.max(0, limit - b.count),
    resetAt: b.resetAt,
  };
}
