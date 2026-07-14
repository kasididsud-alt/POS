import { NextRequest } from "next/server";
import { getAppContext } from "@/lib/auth";
import { outputTaxRows } from "@/lib/vat-report";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ดาวน์โหลดรายงานภาษีขายรายใบกำกับเป็น CSV (?m=YYYY-MM) — เจ้าของร้านเท่านั้น
// นำหน้าไฟล์ด้วย BOM ให้ Excel เปิดภาษาไทยไม่เพี้ยน
export async function GET(req: NextRequest) {
  const ctx = await getAppContext();
  if (!ctx?.org) return new Response("unauthorized", { status: 401 });
  if (ctx.membership?.role !== "owner") {
    return new Response("forbidden", { status: 403 });
  }

  const m = req.nextUrl.searchParams.get("m") ?? "";
  if (!/^\d{4}-\d{2}$/.test(m)) {
    return new Response("bad month (expect YYYY-MM)", { status: 400 });
  }

  const rate = Number(ctx.org.vat_rate ?? 7);
  const rows = await outputTaxRows(ctx.org.id, m, rate);
  const sum = rows.reduce(
    (a, r) => ({
      base: a.base + r.base,
      vat: a.vat + r.vat,
      total: a.total + r.total,
    }),
    { base: 0, vat: 0, total: 0 },
  );

  const esc = (s: string) => `"${s.replaceAll('"', '""')}"`;
  const lines = [
    [
      "ลำดับ",
      "วันที่",
      "เลขที่ใบกำกับ",
      "ประเภทเอกสาร",
      "ชื่อผู้ซื้อสินค้า/ผู้รับบริการ",
      "เลขประจำตัวผู้เสียภาษีของผู้ซื้อ",
      "สถานประกอบการของผู้ซื้อ",
      "มูลค่าสินค้า/บริการ (ฐานภาษี)",
      "จำนวนเงินภาษีมูลค่าเพิ่ม",
      "จำนวนเงินรวม",
    ],
    ...rows.map((r, i) => [
      String(i + 1),
      r.date,
      r.docNo,
      r.kind === "return" ? "คืนสินค้า/ลดหนี้ (อ้างอิงบิลเดิม)" : "ใบกำกับภาษี",
      r.buyerName ?? "",
      r.buyerTaxId ?? "",
      r.buyerTaxId
        ? r.buyerBranch
          ? `สาขา ${r.buyerBranch}`
          : "สำนักงานใหญ่"
        : "",
      r.base.toFixed(2),
      r.vat.toFixed(2),
      r.total.toFixed(2),
    ]),
    [
      "",
      "",
      "",
      "",
      "",
      "",
      "รวมทั้งงวด (สุทธิ)",
      round2(sum.base).toFixed(2),
      round2(sum.vat).toFixed(2),
      round2(sum.total).toFixed(2),
    ],
  ].map((cols) => cols.map(esc).join(","));

  const csv = "\uFEFF" + lines.join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="output-tax-report-${m}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
