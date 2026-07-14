import Link from "next/link";
import { requireOwnerPage } from "@/lib/guard";
import { query } from "@/lib/db";
import { formatTHB } from "@/lib/format";
import { monthBounds, outputTaxRows, type OutputTaxRow } from "@/lib/vat-report";
import PrintButton from "@/components/PrintButton";
import MonthSelect from "./MonthSelect";

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
  searchParams: Promise<{ m?: string; v?: string }>;
}) {
  const ctx = await requireOwnerPage();
  const orgId = ctx.org.id;
  const rate = Number(ctx.org.vat_rate ?? 7);

  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : currentMonth();
  // มุมมอง: สรุปรายวัน (ยื่น ภ.พ.30) หรือรายใบกำกับ (รายงานภาษีขายตามประกาศฯ ฉ.89)
  const view: "daily" | "inv" = sp.v === "inv" ? "inv" : "daily";
  // ขอบเขตงวดเป็นเวลาผนัง (wall-clock) โซนไทย ให้ตรงกับการ group รายวัน
  // ที่ใช้ (created_at at time zone 'Asia/Bangkok') ด้านล่าง — กันบิลใกล้เที่ยงคืนตกเดือน/วันผิด
  const { start, end } = monthBounds(month);

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
  const orgInitial = Array.from(ctx.org.name.trim())[0] ?? "ข";

  // มุมมองรายใบกำกับ — ดึงเฉพาะตอนเปิดดู (บิลทั้งเดือน อาจหลายร้อยแถว)
  const invRows: OutputTaxRow[] =
    view === "inv" ? await outputTaxRows(orgId, month, rate) : [];

  return (
    <div
      className={`mx-auto space-y-5 ${view === "inv" ? "max-w-5xl" : "max-w-3xl"}`}
    >
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
          <div className="flex rounded-lg border border-[var(--border)] bg-white p-1 text-sm">
            <Link
              href={`/vat-report?m=${month}`}
              className={`rounded-md px-3 py-1 transition-colors ${
                view === "daily"
                  ? "bg-[var(--primary)] text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              สรุปรายวัน
            </Link>
            <Link
              href={`/vat-report?m=${month}&v=inv`}
              className={`rounded-md px-3 py-1 transition-colors ${
                view === "inv"
                  ? "bg-[var(--primary)] text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              รายใบกำกับ
            </Link>
          </div>
          <a
            href={`/api/vat-report/export?m=${month}`}
            className="btn-outline print:hidden"
            download
          >
            ⬇️ CSV
          </a>
          <PrintButton label="🖨️ พิมพ์รายงาน" />
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

      {/* เลือกงวดเดือน — ย้อนหลัง 24 เดือน (เผื่อเดือนเก่ากว่าที่เปิดจาก URL ตรง ๆ) */}
      <div className="print:hidden">
        <MonthSelect
          months={[
            ...(recentMonths(24).includes(month) ? [] : [month]),
            ...recentMonths(24),
          ].map((m) => ({ value: m, label: monthLabel(m) }))}
          current={month}
          view={view}
        />
      </div>

      {/* ตัวรายงาน (พิมพ์ได้) — ธีมเอกสารเดียวกับใบกำกับภาษีเต็มรูป */}
      <div className="card doc-sheet overflow-hidden text-[13px] leading-relaxed">
        {/* แถบสีหัวเอกสาร */}
        <div className="h-1.5 bg-[var(--primary)] [print-color-adjust:exact] [-webkit-print-color-adjust:exact]" />
        <div className="p-8">
          {/* หัวเอกสาร: ร้าน + ตราชื่อรายงาน */}
          <div className="flex items-start justify-between gap-6">
            <div className="flex max-w-[56%] items-start gap-3">
              {ctx.org.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ctx.org.logo_url}
                  alt="โลโก้ร้าน"
                  className="h-12 w-12 shrink-0 object-contain"
                />
              ) : (
                <div className="doc-display grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[var(--primary)] text-xl font-bold text-white [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
                  {orgInitial}
                </div>
              )}
              <div>
                <div className="doc-display text-xl font-bold leading-tight">
                  {ctx.org.name}
                </div>
                <div className="mt-0.5 text-xs text-[var(--muted)]">
                  สำนักงานใหญ่
                </div>
                {ctx.org.tax_id && (
                  <div className="mt-0.5 text-xs text-[var(--muted)]">
                    เลขประจำตัวผู้เสียภาษี{" "}
                    <span className="doc-num font-semibold text-[var(--foreground)]">
                      {ctx.org.tax_id}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="inline-block border-2 border-[var(--foreground)] p-1 text-center">
                <div className="border border-[var(--foreground)] px-4 py-1.5">
                  <div className="doc-display text-base font-bold leading-tight">
                    รายงานภาษีขาย
                  </div>
                  <div className="doc-num mt-0.5 text-[9px] tracking-[0.3em] text-[var(--muted)]">
                    OUTPUT TAX REPORT
                  </div>
                </div>
              </div>
              <div className="doc-num mt-1.5 text-[10px] tracking-[0.15em] text-[var(--muted)]">
                {view === "inv"
                  ? "รายใบกำกับ · ตามประกาศฯ VAT ฉ.89"
                  : "ประกอบแบบ ภ.พ.30"}
              </div>
            </div>
          </div>

          {/* งวด / อัตราภาษี / จำนวนรายการ */}
          <div className="mt-5 grid grid-cols-3 divide-x divide-[var(--border)] rounded-md border border-[var(--border)]">
            <MetaCell label="เดือนภาษี / Tax Period" value={monthLabel(month)} />
            <MetaCell label="อัตราภาษี / VAT Rate" value={`${rate}%`} mono />
            <MetaCell
              label={
                view === "inv"
                  ? "จำนวนรายการ / Entries"
                  : "จำนวนใบกำกับ / Invoices"
              }
              value={
                view === "inv" ? `${invRows.length} รายการ` : `${monthBills} ใบ`
              }
              mono
            />
          </div>

          {/* สรุปยอดทั้งเดือน — เฉพาะมุมมองสรุป (มุมมองรายใบกำกับคงรูปแบบเอกสารทางการ) */}
          {view === "daily" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat
                label="ยอดขายสุทธิ (รวม VAT, หักคืน)"
                value={formatTHB(monthTotal)}
              />
              <Stat label="มูลค่าฐานภาษี (ก่อน VAT)" value={formatTHB(monthBase)} />
              <Stat
                label={`ภาษีขายที่ต้องนำส่ง (VAT ${rate}%)`}
                value={formatTHB(monthVat)}
                highlight
              />
            </div>
          )}

          {view === "inv" ? (
            /* ============ รายใบกำกับ (รายงานภาษีขายฉบับตรวจ) ============ */
            <div className="mt-6">
              {invRows.length === 0 ? (
                <p className="rounded-md border border-dashed border-[var(--border)] py-8 text-center text-sm text-[var(--muted)]">
                  ไม่มียอดขายในเดือนนี้
                </p>
              ) : (
                <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full min-w-[640px] border-collapse text-xs">
                  <thead>
                    <tr className="bg-[var(--foreground)] text-left text-white [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
                      <Th className="w-9 text-center" en="NO.">
                        ลำดับ
                      </Th>
                      <Th className="w-20" en="DATE">
                        วันที่
                      </Th>
                      <Th className="w-28" en="INVOICE NO.">
                        เลขที่ใบกำกับ
                      </Th>
                      <Th className="text-left" en="BUYER">
                        ชื่อผู้ซื้อ/ผู้รับบริการ
                      </Th>
                      <Th className="w-28" en="BUYER TAX ID">
                        เลขผู้เสียภาษีผู้ซื้อ
                      </Th>
                      <Th className="w-24 text-right" en="TAX BASE">
                        ฐานภาษี
                      </Th>
                      <Th className="w-20 text-right" en="VAT">
                        ภาษี
                      </Th>
                      <Th className="w-24 text-right" en="TOTAL">
                        รวม
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {invRows.map((r, i) => (
                      <tr
                        key={`${r.kind}-${r.docNo}-${i}`}
                        className={r.kind === "return" ? "text-rose-700" : ""}
                      >
                        <Td className="doc-num text-center text-[var(--muted)]">
                          {i + 1}
                        </Td>
                        <Td className="doc-num">
                          {r.date.slice(8, 10)}/{r.date.slice(5, 7)}/
                          {Number(r.date.slice(0, 4)) + 543}
                        </Td>
                        <Td className="doc-num">
                          {r.docNo}
                          {r.kind === "return" && (
                            <span className="ml-1 rounded-sm bg-rose-50 px-1 text-[9px]">
                              คืนสินค้า
                            </span>
                          )}
                        </Td>
                        <Td>
                          {r.buyerName ?? (
                            <span className="text-[var(--muted)]">
                              ลูกค้าทั่วไป (ขายปลีก)
                            </span>
                          )}
                        </Td>
                        <Td className="doc-num">
                          {r.buyerTaxId ?? "—"}
                          {r.buyerTaxId && (
                            <div className="text-[9px] text-[var(--muted)]">
                              {r.buyerBranch
                                ? `สาขา ${r.buyerBranch}`
                                : "สำนักงานใหญ่"}
                            </div>
                          )}
                        </Td>
                        <Td className="doc-num text-right">
                          {formatTHB(r.base)}
                        </Td>
                        <Td className="doc-num text-right">{formatTHB(r.vat)}</Td>
                        <Td className="doc-num text-right">
                          {formatTHB(r.total)}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
                      <Td className="text-center" colSpan={5}>
                        รวมทั้งงวด (สุทธิ)
                      </Td>
                      <Td className="doc-num text-right">
                        {formatTHB(monthBase)}
                      </Td>
                      <Td className="doc-num text-right">
                        {formatTHB(monthVat)}
                      </Td>
                      <Td className="doc-num text-right">
                        {formatTHB(monthTotal)}
                      </Td>
                    </tr>
                  </tfoot>
                </table>
                </div>
              )}
            </div>
          ) : (
          /* ============ สรุปรายวัน (ยื่น ภ.พ.30) ============ */
          <div className="mt-6">
            {rows.length === 0 ? (
              <p className="rounded-md border border-dashed border-[var(--border)] py-8 text-center text-sm text-[var(--muted)]">
                ไม่มียอดขายในเดือนนี้
              </p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[var(--foreground)] text-left text-white [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
                    <Th className="text-left" en="DATE">
                      วันที่
                    </Th>
                    <Th className="w-20 text-right" en="BILLS">
                      จำนวนใบ
                    </Th>
                    <Th className="w-32 text-right" en="TAX BASE">
                      ฐานภาษี
                    </Th>
                    <Th className="w-32 text-right" en="OUTPUT TAX">
                      ภาษีขาย
                    </Th>
                    <Th className="w-32 text-right" en="TOTAL">
                      รวม
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const total = Number(r.total);
                    const vat = Number(r.vat);
                    const base = total - vat;
                    return (
                      <tr key={r.d}>
                        <Td className="doc-num">
                          {r.d.slice(8, 10)}/{r.d.slice(5, 7)}/
                          {Number(r.d.slice(0, 4)) + 543}
                        </Td>
                        <Td className="doc-num text-right">{r.bills}</Td>
                        <Td className="doc-num text-right">{formatTHB(base)}</Td>
                        <Td className="doc-num text-right">{formatTHB(vat)}</Td>
                        <Td className="doc-num text-right">{formatTHB(total)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
                    <Td>รวมทั้งเดือน (สุทธิ)</Td>
                    <Td className="doc-num text-right">{monthBills}</Td>
                    <Td className="doc-num text-right">{formatTHB(monthBase)}</Td>
                    <Td className="doc-num text-right">{formatTHB(monthVat)}</Td>
                    <Td className="doc-num text-right">{formatTHB(monthTotal)}</Td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
          )}

          {/* ยอดนำส่งเด่นสุดท้าย */}
          <div className="mt-4 flex items-center justify-between rounded-md bg-[var(--foreground)] px-4 py-2.5 text-white [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
            <span className="doc-display font-semibold">
              ภาษีขายสุทธิประจำงวด {monthLabel(month)}
            </span>
            <span className="doc-num text-lg font-bold">
              {formatTHB(monthVat)}
            </span>
          </div>

          {/* ลายเซ็นผู้จัดทำ/ผู้มีอำนาจ */}
          <div className="mt-8 grid grid-cols-2 gap-8 text-center text-xs">
            <SignBox label="ผู้จัดทำ" en="PREPARED BY" />
            <SignBox label="ผู้มีอำนาจลงนาม" en="AUTHORIZED SIGNATURE" />
          </div>

          <p className="mt-6 text-[10px] text-[var(--muted)]">
            * คำนวณแบบราคารวมภาษี (VAT {rate}%) รวมภาษีต่อใบเสร็จให้ตรงกับเอกสารจริง
            และหักยอดคืนสินค้าในงวดออกแล้ว (ยอดสุทธิ) — วันที่/งวดอิงเวลาไทย (Asia/Bangkok).
            {view === "inv" && (
              <>
                {" "}
                รายการคืนสินค้าแสดงเป็นยอดติดลบโดยอ้างอิงเลขที่บิลเดิม
                (ระบบยังไม่ออกเลขใบลดหนี้แยก).
              </>
            )}{" "}
            ตรวจสอบกับเอกสารจริงก่อนยื่นแบบ ภ.พ.30 ทุกครั้ง
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3.5 ${
        highlight
          ? "border-[var(--primary)] bg-[var(--primary)]/5"
          : "border-[var(--border)]"
      }`}
    >
      <div className="text-[11px] text-[var(--muted)]">{label}</div>
      <div className="doc-num mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

function MetaCell({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="px-3 py-2">
      <div className="text-[10px] text-[var(--muted)]">{label}</div>
      <div className={`mt-0.5 font-semibold ${mono ? "doc-num" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function SignBox({ label, en }: { label: string; en: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] px-6 pb-3 pt-14">
      <div className="border-t border-dotted border-[var(--foreground)] pt-1.5 font-medium">
        {label}
      </div>
      <div className="doc-num mt-0.5 text-[8px] tracking-[0.2em] text-[var(--muted)]">
        {en}
      </div>
      <div className="mt-2 text-[var(--muted)]">
        วันที่ ........./........./.........
      </div>
    </div>
  );
}

function Th({
  className = "",
  en,
  children,
}: {
  className?: string;
  en?: string;
  children: React.ReactNode;
}) {
  return (
    <th className={`px-2.5 py-2 text-xs font-semibold ${className}`}>
      <div>{children}</div>
      {en && (
        <div className="doc-num text-[8px] font-normal tracking-[0.2em] opacity-70">
          {en}
        </div>
      )}
    </th>
  );
}

function Td({
  className = "",
  colSpan,
  children,
}: {
  className?: string;
  colSpan?: number;
  children: React.ReactNode;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`border border-[var(--border)] px-2.5 py-2 align-top ${className}`}
    >
      {children}
    </td>
  );
}
