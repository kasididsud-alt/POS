import Link from "next/link";
import { requireOwnerPage } from "@/lib/guard";
import { query } from "@/lib/db";
import { formatTHB } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

/** YYYY-MM ปัจจุบัน */
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** รายชื่อเดือนย้อนหลัง 12 เดือน (YYYY-MM) */
function recentMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

function monthLabel(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  const names = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ];
  return `${names[mo - 1]} ${y + 543}`;
}

export default async function VatReportPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const ctx = await requireOwnerPage();
  const orgId = ctx.org.id;
  const rate = Number(ctx.org.vat_rate ?? 7);

  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : currentMonth();
  const [y, mo] = month.split("-").map(Number);
  // ขอบเขตงวดเป็นเวลาผนัง (wall-clock) โซนไทย ให้ตรงกับการ group รายวัน
  // ที่ใช้ (created_at at time zone 'Asia/Bangkok') ด้านล่าง — กันบิลใกล้เที่ยงคืนตกเดือน/วันผิด
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const start = `${y}-${pad2(mo)}-01 00:00:00`;
  const nextY = mo === 12 ? y + 1 : y;
  const nextMo = mo === 12 ? 1 : mo + 1;
  const end = `${nextY}-${pad2(nextMo)}-01 00:00:00`;

  // คำนวณ VAT ต่อใบ (แล้วค่อยรวม) เพื่อให้ตรงกับที่พิมพ์บนใบเสร็จจริง (vatInclusive per bill)
  // และหักยอดคืนสินค้า (sale_returns) ในงวดเดียวกันออก → ภาษีขายสุทธิ (ตาม ภ.พ.30)
  // ทั้งขอบเขตงวดและการ group ใช้โซนเวลา 'Asia/Bangkok' ตัวเดียวกันทั้งหมด
  const rows = await query<{
    d: string;
    bills: number;
    vat: string;
    total: string;
  }>(
    `with s as (
       select (created_at at time zone 'Asia/Bangkok')::date d,
              count(*)::int bills,
              sum(round(total - total * 100.0 / (100.0 + $4::numeric), 2)) vat,
              sum(total) total
         from sales
        where org_id = $1
          and (created_at at time zone 'Asia/Bangkok') >= $2::timestamp
          and (created_at at time zone 'Asia/Bangkok') <  $3::timestamp
        group by 1
     ),
     r as (
       select (created_at at time zone 'Asia/Bangkok')::date d,
              sum(round(total_refund - total_refund * 100.0 / (100.0 + $4::numeric), 2)) vat,
              sum(total_refund) total
         from sale_returns
        where org_id = $1
          and (created_at at time zone 'Asia/Bangkok') >= $2::timestamp
          and (created_at at time zone 'Asia/Bangkok') <  $3::timestamp
        group by 1
     )
     select to_char(coalesce(s.d, r.d), 'YYYY-MM-DD') d,
            coalesce(s.bills, 0) bills,
            coalesce(s.vat, 0) - coalesce(r.vat, 0) vat,
            coalesce(s.total, 0) - coalesce(r.total, 0) total
       from s full outer join r on s.d = r.d
      order by 1`,
    [orgId, start, end, rate],
  );

  const monthTotal = rows.reduce((a, r) => a + Number(r.total), 0);
  const monthVat = rows.reduce((a, r) => a + Number(r.vat), 0);
  const monthBills = rows.reduce((a, r) => a + Number(r.bills), 0);
  const monthBase = monthTotal - monthVat;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">รายงานภาษีขาย (ภ.พ.30)</h1>
          <p className="text-sm text-[var(--muted)]">
            สรุปภาษีขายรายเดือนสำหรับยื่นกรมสรรพากร
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/reports" className="text-sm text-[var(--primary)]">
            ← รายงาน
          </Link>
          <PrintButton />
        </div>
      </div>

      {!ctx.org.vat_registered && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 print:hidden">
          ⚠️ ร้านยังไม่ได้เปิดใช้ VAT —{" "}
          <Link href="/settings" className="underline">
            ไปตั้งค่า
          </Link>{" "}
          เพื่อให้ตัวเลขภาษีถูกต้อง
        </div>
      )}

      {/* เลือกเดือน */}
      <div className="flex flex-wrap gap-1 print:hidden">
        {recentMonths(12).map((m) => (
          <Link
            key={m}
            href={`/vat-report?m=${m}`}
            className={`rounded-md border px-3 py-1 text-sm ${
              m === month
                ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                : "border-[var(--border)] bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {monthLabel(m)}
          </Link>
        ))}
      </div>

      {/* หัวรายงาน (พิมพ์ได้) */}
      <div className="card p-6">
        <div className="text-center">
          <div className="text-lg font-bold">{ctx.org.name}</div>
          {ctx.org.tax_id && (
            <div className="text-xs text-[var(--muted)]">
              เลขประจำตัวผู้เสียภาษี {ctx.org.tax_id}
            </div>
          )}
          <div className="mt-1 text-sm font-medium">
            รายงานภาษีขาย — ประจำเดือน {monthLabel(month)}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Stat label="ยอดขายสุทธิ (รวม VAT, หักคืน)" value={formatTHB(monthTotal)} hint={`${monthBills} ใบ`} />
          <Stat label="มูลค่าฐานภาษี (ก่อน VAT)" value={formatTHB(monthBase)} />
          <Stat label={`ภาษีขาย (VAT ${rate}%)`} value={formatTHB(monthVat)} highlight />
        </div>

        {/* รายวัน */}
        <div className="mt-6">
          <h2 className="font-semibold">รายละเอียดรายวัน</h2>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--muted)]">
              ไม่มียอดขายในเดือนนี้
            </p>
          ) : (
            <table className="mt-2 w-full text-sm">
              <thead className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                <tr>
                  <th className="py-2">วันที่</th>
                  <th className="py-2 text-right">จำนวนใบ</th>
                  <th className="py-2 text-right">ฐานภาษี</th>
                  <th className="py-2 text-right">ภาษีขาย</th>
                  <th className="py-2 text-right">รวม</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const total = Number(r.total);
                  const vat = Number(r.vat);
                  const base = total - vat;
                  return (
                    <tr key={r.d} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-1.5">
                        {r.d.slice(8, 10)}/{r.d.slice(5, 7)}/{Number(r.d.slice(0, 4)) + 543}
                      </td>
                      <td className="py-1.5 text-right">{r.bills}</td>
                      <td className="py-1.5 text-right">{formatTHB(base)}</td>
                      <td className="py-1.5 text-right">{formatTHB(vat)}</td>
                      <td className="py-1.5 text-right">{formatTHB(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--border)] font-bold">
                  <td className="py-2">รวมทั้งเดือน (สุทธิ)</td>
                  <td className="py-2 text-right">{monthBills}</td>
                  <td className="py-2 text-right">{formatTHB(monthBase)}</td>
                  <td className="py-2 text-right">{formatTHB(monthVat)}</td>
                  <td className="py-2 text-right">{formatTHB(monthTotal)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <p className="mt-4 text-[10px] text-[var(--muted)]">
          * คำนวณแบบราคารวมภาษี (VAT {rate}%) รวมภาษีต่อใบเสร็จให้ตรงกับเอกสารจริง
          และหักยอดคืนสินค้าในงวดออกแล้ว (ยอดสุทธิ) — วันที่/งวดอิงเวลาไทย (Asia/Bangkok).
          ตรวจสอบกับเอกสารจริงก่อนยื่นแบบ ภ.พ.30 ทุกครั้ง
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight ? "border-[var(--primary)] bg-[var(--primary)]/5" : "border-[var(--border)]"
      }`}
    >
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-[var(--muted)]">{hint}</div>}
    </div>
  );
}
