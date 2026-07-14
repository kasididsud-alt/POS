import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { query, one } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { formatTHB, formatDate, formatDateTime, bahtText } from "@/lib/format";
import { vatInclusive } from "@/lib/vat";
import ThermalPrintButton from "@/components/ThermalPrintButton";
import AutoPrint from "@/components/AutoPrint";
import type { Sale, SaleItem, Customer } from "@/lib/types";

// ข้อความวิธีชำระเงินบนใบเสร็จ/ใบกำกับ — ต้องครบทุกวิธี ไม่ใช่ cash/พร้อมเพย์ แบบ 2 ทาง
const PAY_LABEL: Record<string, string> = {
  cash: "เงินสด",
  promptpay: "พร้อมเพย์",
  credit: "ค้างชำระ (ขายเชื่อ)",
};
const payLabel = (m: string) => PAY_LABEL[m] ?? m;

export default async function SaleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ form?: string; print?: string }>;
}) {
  const { id } = await params;
  const { form, print } = await searchParams;
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/onboarding");

  const s = await one<Sale & { customer_id: string | null }>(
    "select * from sales where id = $1 and org_id = $2",
    [id, ctx.org.id],
  );
  if (!s) notFound();

  const items = await query<SaleItem>(
    "select * from sale_items where sale_id = $1",
    [id],
  );

  // org_id filter สำคัญ: กันใบเสร็จโชว์ PII ลูกค้าของร้านอื่น หาก customer_id
  // ถูกยัดข้ามร้านมา (ดู checkout_sale validation ฝั่ง SQL)
  const customer = s.customer_id
    ? await one<Customer>(
        "select * from customers where id = $1 and org_id = $2",
        [s.customer_id, ctx.org.id],
      )
    : null;

  const vatOn = ctx.org.vat_registered;
  const rate = Number(ctx.org.vat_rate ?? 7);
  const vat = vatInclusive(Number(s.total), rate);
  const full = vatOn && form === "full";
  // เติมแถวว่างให้ตารางเต็มรูปสูงคงที่แบบเล่มบิล — บิลสั้น/ยาวหน้าตาไม่เพี้ยนตามจำนวนรายการ
  const fillerRows = Math.max(0, 8 - items.length);
  const orgInitial = Array.from(ctx.org.name.trim())[0] ?? "ข";

  const docTitle = !vatOn
    ? "ใบเสร็จรับเงิน"
    : full
      ? "ใบเสร็จรับเงิน / ใบกำกับภาษี"
      : "ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ";

  return (
    <div className={`mx-auto ${full ? "max-w-3xl" : "max-w-lg"}`}>
      {print && <AutoPrint paper={print} />}
      {/* แถบเครื่องมือ — ไม่พิมพ์ */}
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Link href="/sales" className="text-sm text-[var(--primary)]">
          ← กลับ
        </Link>
        <div className="flex items-center gap-2">
          {vatOn && (
            <div className="flex rounded-lg border border-[var(--border)] bg-white p-1 text-sm">
              <Link
                href={`/sales/${s.id}`}
                className={`rounded-md px-3 py-1 transition-colors ${!full ? "bg-[var(--primary)] text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                อย่างย่อ
              </Link>
              <Link
                href={`/sales/${s.id}?form=full`}
                className={`rounded-md px-3 py-1 transition-colors ${full ? "bg-[var(--primary)] text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                เต็มรูป
              </Link>
            </div>
          )}
          <ThermalPrintButton />
        </div>
      </div>

      {full && !customer?.tax_id && (
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 print:hidden">
          ⚠️ ใบกำกับภาษีเต็มรูปต้องมีข้อมูลผู้ซื้อ — บิลนี้ยัง
          {customer ? "ไม่ได้กรอกเลขผู้เสียภาษีของลูกค้า" : "ไม่ได้ระบุลูกค้า"}{" "}
          (เพิ่มได้ที่หน้าลูกค้า)
        </div>
      )}

      {full ? (
        /* ===================== ใบกำกับภาษีเต็มรูป (A4) ===================== */
        <div className="card mt-3 overflow-hidden text-[13px] leading-relaxed">
          {/* แถบสีหัวเอกสาร */}
          <div className="h-1.5 bg-[var(--primary)] [print-color-adjust:exact] [-webkit-print-color-adjust:exact]" />
          <div className="p-8">
            {/* หัวเอกสาร: ผู้ขาย + ตราชื่อเอกสาร */}
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
                  {ctx.org.address && (
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      {ctx.org.address}
                    </div>
                  )}
                  <div className="mt-0.5 text-xs text-[var(--muted)]">
                    {ctx.org.phone && <>โทร {ctx.org.phone} · </>}สำนักงานใหญ่
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
                      {docTitle}
                    </div>
                    <div className="doc-num mt-0.5 text-[9px] tracking-[0.3em] text-[var(--muted)]">
                      TAX INVOICE / RECEIPT
                    </div>
                  </div>
                </div>
                <div className="doc-num mt-1.5 text-[10px] tracking-[0.15em] text-[var(--muted)]">
                  ต้นฉบับ · ORIGINAL
                </div>
              </div>
            </div>

            {/* เลขที่ / วันที่ / วิธีชำระ */}
            <div className="mt-5 grid grid-cols-3 divide-x divide-[var(--border)] rounded-md border border-[var(--border)]">
              <MetaCell label="เลขที่ / No." value={s.bill_no} mono />
              <MetaCell label="วันที่ / Date" value={formatDate(s.created_at)} />
              <MetaCell
                label="ชำระโดย / Payment"
                value={payLabel(s.payment_method)}
              />
            </div>

            {/* ผู้ซื้อ */}
            <div className="mt-4 overflow-hidden rounded-md border border-[var(--border)]">
              <div className="flex items-baseline justify-between border-b border-[var(--border)] bg-slate-50 px-3 py-1.5">
                <span className="text-[11px] font-semibold text-slate-600">
                  ลูกค้า / ผู้ซื้อ
                </span>
                <span className="doc-num text-[9px] tracking-[0.25em] text-[var(--muted)]">
                  CUSTOMER
                </span>
              </div>
              <div className="px-3 py-2.5">
                <div className="font-semibold">{customer?.name ?? "—"}</div>
                {customer?.address && (
                  <div className="mt-0.5 text-xs text-[var(--muted)]">
                    {customer.address}
                  </div>
                )}
                {customer?.tax_id && (
                  <div className="mt-0.5 text-xs text-[var(--muted)]">
                    เลขประจำตัวผู้เสียภาษี{" "}
                    <span className="doc-num font-medium text-[var(--foreground)]">
                      {customer.tax_id}
                    </span>
                    {customer.branch ? ` · สาขา ${customer.branch}` : " · สำนักงานใหญ่"}
                  </div>
                )}
              </div>
            </div>

            {/* ตารางรายการ */}
            <table className="mt-5 w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[var(--foreground)] text-left text-white [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
                  <Th className="w-12 text-center" en="NO.">
                    ลำดับ
                  </Th>
                  <Th className="text-left" en="DESCRIPTION">
                    รายการ
                  </Th>
                  <Th className="w-28 text-right" en="UNIT PRICE">
                    ราคา/หน่วย
                  </Th>
                  <Th className="w-16 text-right" en="QTY">
                    จำนวน
                  </Th>
                  <Th className="w-32 text-right" en="AMOUNT">
                    จำนวนเงิน
                  </Th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={it.id}>
                    <Td className="doc-num text-center text-[var(--muted)]">
                      {i + 1}
                    </Td>
                    <Td>{it.name_snapshot}</Td>
                    <Td className="doc-num text-right">
                      {formatTHB(Number(it.unit_price))}
                    </Td>
                    <Td className="doc-num text-right">{it.qty}</Td>
                    <Td className="doc-num text-right">
                      {formatTHB(Number(it.line_total))}
                    </Td>
                  </tr>
                ))}
                {Array.from({ length: fillerRows }).map((_, i) => (
                  <tr key={`filler-${i}`}>
                    <Td className="text-center">&nbsp;</Td>
                    <Td>{""}</Td>
                    <Td>{""}</Td>
                    <Td>{""}</Td>
                    <Td>{""}</Td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* จำนวนเงินตัวอักษร + สรุปยอด */}
            <div className="mt-4 flex items-stretch justify-between gap-6">
              <div className="flex flex-1 flex-col justify-between gap-3">
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] text-[var(--muted)]">
                    จำนวนเงินเป็นตัวอักษร / Amount in words
                  </div>
                  <div className="doc-display mt-0.5 font-semibold">
                    ({bahtText(vat.total)})
                  </div>
                </div>
                <div className="text-[11px] leading-relaxed text-[var(--muted)]">
                  หมายเหตุ: ราคาสินค้ารวมภาษีมูลค่าเพิ่มแล้ว
                </div>
              </div>
              <div className="w-72 shrink-0 text-sm">
                <Row label="รวมเป็นเงิน" value={formatTHB(Number(s.subtotal))} />
                {Number(s.discount) > 0 && (
                  <Row
                    label="ส่วนลด"
                    value={`- ${formatTHB(Number(s.discount))}`}
                  />
                )}
                <Row label="มูลค่าก่อนภาษี" value={formatTHB(vat.base)} />
                <Row
                  label={`ภาษีมูลค่าเพิ่ม ${rate}%`}
                  value={formatTHB(vat.vat)}
                />
                <div className="mt-2 flex items-center justify-between rounded-md bg-[var(--foreground)] px-3 py-2 text-white [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
                  <span className="doc-display font-semibold">
                    จำนวนเงินทั้งสิ้น
                  </span>
                  <span className="doc-num text-lg font-bold">
                    {formatTHB(vat.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* ลายเซ็น */}
            <div className="mt-8 grid grid-cols-2 gap-8 text-center text-xs">
              <SignBox label="ผู้รับเงิน / ผู้มีอำนาจลงนาม" en="AUTHORIZED SIGNATURE" />
              <SignBox label="ผู้รับสินค้า" en="RECEIVED BY" />
            </div>

            <p className="mt-6 text-center text-[10px] text-[var(--muted)]">
              เอกสารนี้จัดทำด้วยระบบคอมพิวเตอร์ · {ctx.org.name}
            </p>
          </div>
        </div>
      ) : (
        /* ===================== ใบเสร็จ/อย่างย่อ (สลิปความร้อน) ===================== */
        <div className="card mt-3 p-6">
          <div className="text-center">
            {ctx.org.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ctx.org.logo_url}
                alt="โลโก้ร้าน"
                className="mx-auto mb-1.5 h-14 w-auto max-w-[60%] object-contain"
              />
            )}
            <div className="text-lg font-bold">{ctx.org.name}</div>
            {ctx.org.address && (
              <div className="text-xs text-[var(--muted)]">{ctx.org.address}</div>
            )}
            {(ctx.org.phone || ctx.org.tax_id) && (
              <div className="text-xs text-[var(--muted)]">
                {ctx.org.phone && <>โทร {ctx.org.phone}</>}
                {ctx.org.phone && ctx.org.tax_id && " · "}
                {ctx.org.tax_id && <>เลขผู้เสียภาษี {ctx.org.tax_id}</>}
              </div>
            )}
            <div className="mt-2">
              <div className="text-sm font-medium">{docTitle}</div>
              <div className="text-xs text-[var(--muted)]">เลขที่ {s.bill_no}</div>
              <div className="text-xs text-[var(--muted)]">
                {formatDateTime(s.created_at)}
              </div>
            </div>
          </div>

          {customer && (
            <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs">
              <div className="font-medium text-slate-700">
                ลูกค้า: {customer.name}
              </div>
              {customer.address && (
                <div className="text-[var(--muted)]">{customer.address}</div>
              )}
              {customer.phone && (
                <div className="text-[var(--muted)]">โทร {customer.phone}</div>
              )}
            </div>
          )}

          <div className="my-4 border-t border-dashed border-[var(--border)]" />

          <table className="w-full text-sm">
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="py-1">
                    {it.name_snapshot}
                    <span className="text-[var(--muted)]">
                      {" "}
                      {formatTHB(Number(it.unit_price))} × {it.qty}
                    </span>
                  </td>
                  <td className="py-1 text-right">
                    {formatTHB(Number(it.line_total))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="my-4 border-t border-dashed border-[var(--border)]" />

          <div className="space-y-1 text-sm">
            <Row label="ยอดรวม" value={formatTHB(Number(s.subtotal))} />
            {Number(s.discount) > 0 && (
              <Row label="ส่วนลด" value={`- ${formatTHB(Number(s.discount))}`} />
            )}

            {vatOn ? (
              <div className="mt-2 rounded-md bg-slate-50 px-3 py-2">
                <Row
                  label="มูลค่าสินค้า (ก่อน VAT)"
                  value={formatTHB(vat.base)}
                />
                <Row label={`ภาษีมูลค่าเพิ่ม ${rate}%`} value={formatTHB(vat.vat)} />
                <div className="flex justify-between font-bold">
                  <span>จำนวนเงินรวมทั้งสิ้น</span>
                  <span>{formatTHB(vat.total)}</span>
                </div>
              </div>
            ) : (
              <div className="flex justify-between text-lg font-bold">
                <span>สุทธิ</span>
                <span>{formatTHB(Number(s.total))}</span>
              </div>
            )}

            <Row label="ชำระโดย" value={payLabel(s.payment_method)} />
            {s.payment_method === "cash" && (
              <>
                <Row
                  label="รับเงิน"
                  value={formatTHB(Number(s.cash_received ?? 0))}
                />
                <Row label="เงินทอน" value={formatTHB(Number(s.change_due ?? 0))} />
              </>
            )}
          </div>

          {vatOn ? (
            <p className="mt-4 text-center text-[10px] text-[var(--muted)]">
              ราคารวมภาษีมูลค่าเพิ่มแล้ว · เอกสารออกโดยระบบ {ctx.org.name}
            </p>
          ) : (
            <p className="mt-4 text-center text-[10px] text-[var(--muted)]">
              ขอบคุณที่ใช้บริการ
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="doc-num">{value}</span>
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
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <td className={`border border-[var(--border)] px-2.5 py-2 align-top ${className}`}>
      {children}
    </td>
  );
}
