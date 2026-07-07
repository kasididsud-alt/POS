import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { query, one } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { formatTHB, formatDate, formatDateTime, bahtText } from "@/lib/format";
import { vatInclusive } from "@/lib/vat";
import ThermalPrintButton from "@/components/ThermalPrintButton";
import type { Sale, SaleItem, Customer } from "@/lib/types";

export default async function SaleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ form?: string }>;
}) {
  const { id } = await params;
  const { form } = await searchParams;
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

  const customer = s.customer_id
    ? await one<Customer>("select * from customers where id = $1", [
        s.customer_id,
      ])
    : null;

  const vatOn = ctx.org.vat_registered;
  const rate = Number(ctx.org.vat_rate ?? 7);
  const vat = vatInclusive(Number(s.total), rate);
  const full = vatOn && form === "full";

  const docTitle = !vatOn
    ? "ใบเสร็จรับเงิน"
    : full
      ? "ใบเสร็จรับเงิน / ใบกำกับภาษี"
      : "ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ";

  return (
    <div className={`mx-auto ${full ? "max-w-3xl" : "max-w-lg"}`}>
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
        <div className="card mt-3 p-8 text-[13px] leading-relaxed">
          {/* หัวเอกสาร: ผู้ขาย + ชื่อเอกสาร */}
          <div className="flex items-start justify-between gap-6 border-b-2 border-[var(--foreground)] pb-4">
            <div className="max-w-[58%]">
              <div className="text-xl font-bold">{ctx.org.name}</div>
              {ctx.org.address && (
                <div className="mt-0.5 text-xs text-[var(--muted)]">
                  {ctx.org.address}
                </div>
              )}
              {(ctx.org.phone || ctx.org.tax_id) && (
                <div className="mt-0.5 text-xs text-[var(--muted)]">
                  {ctx.org.phone && <>โทร {ctx.org.phone}</>}
                  {ctx.org.phone && ctx.org.tax_id && " · "}
                  {ctx.org.tax_id && (
                    <>เลขประจำตัวผู้เสียภาษี {ctx.org.tax_id}</>
                  )}
                </div>
              )}
              <div className="text-xs text-[var(--muted)]">สำนักงานใหญ่</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="inline-block rounded-md border border-[var(--foreground)] px-4 py-1.5 text-base font-bold">
                {docTitle}
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">(ต้นฉบับ)</div>
            </div>
          </div>

          {/* ผู้ซื้อ + เลขที่/วันที่ */}
          <div className="mt-4 grid grid-cols-[1fr_auto] gap-4">
            <div className="rounded-md border border-[var(--border)] p-3">
              <div className="text-xs font-medium text-[var(--muted)]">
                ลูกค้า / ผู้ซื้อ
              </div>
              <div className="font-semibold">{customer?.name ?? "—"}</div>
              {customer?.address && (
                <div className="text-xs text-[var(--muted)]">
                  {customer.address}
                </div>
              )}
              {customer?.tax_id && (
                <div className="text-xs text-[var(--muted)]">
                  เลขประจำตัวผู้เสียภาษี {customer.tax_id}
                  {customer.branch ? ` · สาขา ${customer.branch}` : " · สำนักงานใหญ่"}
                </div>
              )}
            </div>
            <div className="min-w-[9rem] text-sm">
              <MetaRow label="เลขที่" value={s.bill_no} />
              <MetaRow label="วันที่" value={formatDate(s.created_at)} />
            </div>
          </div>

          {/* ตารางรายการ */}
          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-[var(--muted)]">
                <Th className="w-10 text-center">#</Th>
                <Th className="text-left">รายการ</Th>
                <Th className="w-28 text-right">ราคา/หน่วย</Th>
                <Th className="w-16 text-right">จำนวน</Th>
                <Th className="w-32 text-right">จำนวนเงิน</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id}>
                  <Td className="text-center text-[var(--muted)]">{i + 1}</Td>
                  <Td>{it.name_snapshot}</Td>
                  <Td className="text-right">
                    {formatTHB(Number(it.unit_price))}
                  </Td>
                  <Td className="text-right">{it.qty}</Td>
                  <Td className="text-right">
                    {formatTHB(Number(it.line_total))}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* จำนวนเงินตัวอักษร + สรุปยอด */}
          <div className="mt-3 flex items-stretch justify-between gap-4">
            <div className="flex flex-1 flex-col justify-end rounded-md bg-slate-50 px-3 py-2">
              <span className="text-xs text-[var(--muted)]">
                จำนวนเงินเป็นตัวอักษร
              </span>
              <span className="font-medium">({bahtText(vat.total)})</span>
            </div>
            <div className="w-64 shrink-0 text-sm">
              <Row label="รวมเป็นเงิน" value={formatTHB(Number(s.subtotal))} />
              {Number(s.discount) > 0 && (
                <Row
                  label="ส่วนลด"
                  value={`- ${formatTHB(Number(s.discount))}`}
                />
              )}
              <Row label="มูลค่าก่อนภาษี" value={formatTHB(vat.base)} />
              <Row label={`ภาษีมูลค่าเพิ่ม ${rate}%`} value={formatTHB(vat.vat)} />
              <div className="mt-1 flex justify-between border-t-2 border-[var(--foreground)] pt-1 font-bold">
                <span>จำนวนเงินทั้งสิ้น</span>
                <span>{formatTHB(vat.total)}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 text-xs text-[var(--muted)]">
            ชำระโดย {s.payment_method === "cash" ? "เงินสด" : "พร้อมเพย์"}
          </div>

          {/* ลายเซ็น */}
          <div className="mt-12 grid grid-cols-2 gap-10 text-center text-xs text-[var(--muted)]">
            <div>
              <div className="mx-6 border-t border-[var(--foreground)] pt-1">
                ผู้รับเงิน / ผู้มีอำนาจลงนาม
              </div>
              <div className="mt-1">วันที่ ............................</div>
            </div>
            <div>
              <div className="mx-6 border-t border-[var(--foreground)] pt-1">
                ผู้รับสินค้า
              </div>
              <div className="mt-1">วันที่ ............................</div>
            </div>
          </div>

          <p className="mt-6 text-center text-[10px] text-[var(--muted)]">
            ราคารวมภาษีมูลค่าเพิ่มแล้ว · เอกสารออกโดยระบบ {ctx.org.name}
          </p>
        </div>
      ) : (
        /* ===================== ใบเสร็จ/อย่างย่อ (สลิปความร้อน) ===================== */
        <div className="card mt-3 p-6">
          <div className="text-center">
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

            <Row
              label="ชำระโดย"
              value={s.payment_method === "cash" ? "เงินสด" : "พร้อมเพย์"}
            />
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
    <div className="flex justify-between">
      <span className="text-[var(--muted)]">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Th({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <th className={`border border-[var(--border)] px-2 py-1.5 font-medium ${className}`}>
      {children}
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
    <td className={`border border-[var(--border)] px-2 py-1.5 align-top ${className}`}>
      {children}
    </td>
  );
}
