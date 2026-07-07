// คำนวณ VAT แบบ "ราคารวมภาษีแล้ว" (VAT-inclusive) ตามมาตรฐานค้าปลีกไทย
// total = ยอดสุทธิที่ลูกค้าจ่าย (รวม VAT แล้ว)

export type VatBreakdown = {
  /** มูลค่าก่อน VAT (ฐานภาษี) */
  base: number;
  /** จำนวนภาษีมูลค่าเพิ่ม */
  vat: number;
  /** ยอดรวมสุทธิ (รวม VAT) */
  total: number;
  rate: number;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** ถอด VAT ออกจากยอดที่รวมภาษีแล้ว */
export function vatInclusive(total: number, rate: number): VatBreakdown {
  const t = Number(total) || 0;
  const r = Number(rate) || 0;
  if (r <= 0) return { base: round2(t), vat: 0, total: round2(t), rate: r };
  const vat = round2(t - (t * 100) / (100 + r));
  const base = round2(t - vat);
  return { base, vat, total: round2(t), rate: r };
}
