import Link from "next/link";
import { requireOwnerPage } from "@/lib/guard";
import { query } from "@/lib/db";
import { formatTHB } from "@/lib/format";
import { vatInclusive } from "@/lib/vat";
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
  const start = new Date(y, mo - 1, 1).toISOString();
  const end = new Date(y, mo, 1).toISOString();

  const rows = await query<{ d: string; bills: string; total: number }>(
    `select to_char(created_at::date,'YYYY-MM-DD') d, count(*) bills, sum(total) total
       from sales
      where org_id=$1 and created_at>=$2 and created_at<$3
      group by 1 order by 1`,
    [orgId, start, end],
  );

  const monthTotal = rows.reduce((a, r) => a + Number(r.total), 0);
  const monthBills = rows.reduce((a, r) => a + Number(r.bills), 0);
  const v = vatInclusive(monthTotal, rate);

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
          <Stat label="ยอดขายรวม (รวม VAT)" value={formatTHB(v.total)} hint={`${monthBills} ใบ`} />
          <Stat label="มูลค่าฐานภาษี (ก่อน VAT)" value={formatTHB(v.base)} />
          <Stat label={`ภาษีขาย (VAT ${rate}%)`} value={formatTHB(v.vat)} highlight />
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
                  const dv = vatInclusive(Number(r.total), rate);
                  return (
                    <tr key={r.d} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-1.5">
                        {r.d.slice(8, 10)}/{r.d.slice(5, 7)}/{Number(r.d.slice(0, 4)) + 543}
                      </td>
                      <td className="py-1.5 text-right">{r.bills}</td>
                      <td className="py-1.5 text-right">{formatTHB(dv.base)}</td>
                      <td className="py-1.5 text-right">{formatTHB(dv.vat)}</td>
                      <td className="py-1.5 text-right">{formatTHB(dv.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--border)] font-bold">
                  <td className="py-2">รวมทั้งเดือน</td>
                  <td className="py-2 text-right">{monthBills}</td>
                  <td className="py-2 text-right">{formatTHB(v.base)}</td>
                  <td className="py-2 text-right">{formatTHB(v.vat)}</td>
                  <td className="py-2 text-right">{formatTHB(v.total)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <p className="mt-4 text-[10px] text-[var(--muted)]">
          * คำนวณแบบราคารวมภาษี (VAT {rate}%) — ภาษีขาย = ยอดรวม × {rate}/(100+{rate}).
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
