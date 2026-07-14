import { query } from "@/lib/db";
import { vatInclusive } from "@/lib/vat";

/**
 * ขอบเขตงวดเดือนภาษีเป็นเวลาผนัง (wall-clock) โซนไทย — ต้องใช้คู่กับเงื่อนไข
 * (created_at at time zone 'Asia/Bangkok') เสมอ กันบิลใกล้เที่ยงคืนตกงวดผิด
 */
export function monthBounds(month: string): { start: string; end: string } {
  const [y, mo] = month.split("-").map(Number);
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const nextY = mo === 12 ? y + 1 : y;
  const nextMo = mo === 12 ? 1 : mo + 1;
  return {
    start: `${y}-${pad2(mo)}-01 00:00:00`,
    end: `${nextY}-${pad2(nextMo)}-01 00:00:00`,
  };
}

export type OutputTaxRow = {
  kind: "sale" | "return";
  /** เลขที่ใบกำกับ (รายการคืนสินค้า = เลขบิลเดิมที่อ้างอิง) */
  docNo: string;
  /** วันที่เอกสาร YYYY-MM-DD (เวลาไทย) */
  date: string;
  buyerName: string | null;
  buyerTaxId: string | null;
  buyerBranch: string | null;
  /** ฐานภาษี/ภาษี/ยอดรวม — ติดลบสำหรับรายการคืนสินค้า */
  base: number;
  vat: number;
  total: number;
};

/**
 * รายการภาษีขายรายใบกำกับประจำงวด (รายงานภาษีขายตามประกาศฯ VAT ฉ.89):
 * บิลขายทุกใบ + รายการคืนสินค้า (ติดลบ) เรียงตามวันที่/เลขที่
 * คำนวณ VAT ต่อใบด้วยสูตรเดียวกับใบเสร็จ (vatInclusive) — ผลรวมจึงตรงกับ
 * รายงานสรุปรายวันและเอกสารจริงเสมอ
 */
export async function outputTaxRows(
  orgId: string,
  month: string,
  rate: number,
): Promise<OutputTaxRow[]> {
  const { start, end } = monthBounds(month);
  const rows = await query<{
    kind: "sale" | "return";
    doc_no: string | null;
    d: string;
    buyer_name: string | null;
    buyer_tax_id: string | null;
    buyer_branch: string | null;
    total: string;
  }>(
    `select 'sale' kind, s.bill_no doc_no,
            to_char(s.created_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD') d,
            c.name buyer_name, c.tax_id buyer_tax_id, c.branch buyer_branch,
            s.total::text total
       from sales s
       left join customers c on c.id = s.customer_id and c.org_id = s.org_id
      where s.org_id = $1
        and (s.created_at at time zone 'Asia/Bangkok') >= $2::timestamp
        and (s.created_at at time zone 'Asia/Bangkok') <  $3::timestamp
     union all
     select 'return' kind, s2.bill_no doc_no,
            to_char(r.created_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD') d,
            c2.name, c2.tax_id, c2.branch,
            r.total_refund::text
       from sale_returns r
       left join sales s2 on s2.id = r.sale_id
       left join customers c2 on c2.id = s2.customer_id and c2.org_id = r.org_id
      where r.org_id = $1
        and (r.created_at at time zone 'Asia/Bangkok') >= $2::timestamp
        and (r.created_at at time zone 'Asia/Bangkok') <  $3::timestamp
      order by d, doc_no nulls last, kind`,
    [orgId, start, end],
  );

  return rows.map((r) => {
    const v = vatInclusive(Number(r.total), rate);
    const sign = r.kind === "return" ? -1 : 1;
    return {
      kind: r.kind,
      docNo: r.doc_no ?? "—",
      date: r.d,
      buyerName: r.buyer_name,
      buyerTaxId: r.buyer_tax_id,
      buyerBranch: r.buyer_branch,
      base: sign * v.base,
      vat: sign * v.vat,
      total: sign * v.total,
    };
  });
}
