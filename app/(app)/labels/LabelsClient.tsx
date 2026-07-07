"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Barcode from "@/components/Barcode";
import { formatTHB } from "@/lib/format";
import type { ProductWithStock } from "@/lib/types";

type Selected = Record<string, number>; // productId -> จำนวนป้าย

export default function LabelsClient({
  products,
  orgName,
}: {
  products: ProductWithStock[];
  orgName: string;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Selected>({});
  const [showPrice, setShowPrice] = useState(true);
  const [showName, setShowName] = useState(true);
  const [cols, setCols] = useState(3);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q),
    );
  }, [products, search]);

  function setQty(id: string, qty: number) {
    setSelected((s) => {
      const next = { ...s };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  // รายการป้ายที่จะพิมพ์ (กระจายตามจำนวน)
  const labels = useMemo(() => {
    const out: ProductWithStock[] = [];
    for (const p of products) {
      const n = selected[p.id] ?? 0;
      const code = p.barcode || p.sku;
      if (!code) continue;
      for (let i = 0; i < n; i++) out.push(p);
    }
    return out;
  }, [products, selected]);

  const totalLabels = labels.length;

  return (
    <div>
      {/* ── ตัวควบคุม (ซ่อนตอนพิมพ์) ── */}
      <div className="print:hidden">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">พิมพ์ป้ายบาร์โค้ด</h1>
            <p className="text-sm text-[var(--muted)]">
              เลือกสินค้าและจำนวนป้าย แล้วกดพิมพ์ — บาร์โค้ดสร้างในระบบเอง (CODE128)
            </p>
          </div>
          <Link href="/products" className="text-sm text-[var(--primary)]">
            ← รายการสินค้า
          </Link>
        </div>

        <div className="card mt-4 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              placeholder="ค้นหาชื่อ / บาร์โค้ด / SKU"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input max-w-xs"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showName}
                onChange={(e) => setShowName(e.target.checked)}
              />
              แสดงชื่อ
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showPrice}
                onChange={(e) => setShowPrice(e.target.checked)}
              />
              แสดงราคา
            </label>
            <label className="flex items-center gap-2 text-sm">
              ป้าย/แถว
              <select
                value={cols}
                onChange={(e) => setCols(Number(e.target.value))}
                className="input w-auto"
              >
                {[2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => window.print()}
              disabled={totalLabels === 0}
              className="btn-primary ml-auto"
            >
              🖨️ พิมพ์ {totalLabels > 0 ? `(${totalLabels} ป้าย)` : ""}
            </button>
          </div>
        </div>

        <div className="card mt-4 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[var(--muted)]">
              <tr>
                <th className="px-4 py-2">สินค้า</th>
                <th className="px-4 py-2">บาร์โค้ด/SKU</th>
                <th className="px-4 py-2 text-right">ราคา</th>
                <th className="px-4 py-2 text-center">จำนวนป้าย</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const code = p.barcode || p.sku;
                return (
                  <tr key={p.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-2">{p.name}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {code || (
                        <span className="text-amber-600">— ยังไม่มี —</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {formatTHB(Number(p.price))}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setQty(p.id, (selected[p.id] ?? 0) - 1)
                          }
                          disabled={!code}
                          className="btn-outline h-7 w-7 p-0"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={selected[p.id] ?? 0}
                          disabled={!code}
                          onChange={(e) =>
                            setQty(p.id, Math.max(0, Number(e.target.value)))
                          }
                          className="input w-16 text-center"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setQty(p.id, (selected[p.id] ?? 0) + 1)
                          }
                          disabled={!code}
                          className="btn-outline h-7 w-7 p-0"
                        >
                          +
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── พื้นที่พิมพ์ป้าย ── */}
      <div
        className="mt-4 grid gap-2 print:mt-0 print:gap-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {labels.map((p, i) => {
          const code = (p.barcode || p.sku) as string;
          return (
            <div
              key={`${p.id}-${i}`}
              className="flex flex-col items-center justify-center rounded-md border border-[var(--border)] p-2 text-center print:border print:border-slate-300"
              style={{ breakInside: "avoid" }}
            >
              {showName && (
                <div className="mb-0.5 line-clamp-1 text-xs font-medium">
                  {p.name}
                </div>
              )}
              <Barcode
                value={code}
                height={44}
                moduleWidth={1.6}
                fontSize={11}
                className="block w-full [&_svg]:mx-auto [&_svg]:max-w-full"
              />
              {showPrice && (
                <div className="mt-0.5 text-sm font-bold">
                  {formatTHB(Number(p.price))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalLabels === 0 && (
        <div className="py-16 text-center text-sm text-[var(--muted)] print:hidden">
          ยังไม่ได้เลือกป้าย — กำหนดจำนวนป้ายของสินค้าที่ต้องการด้านบน
          <div className="mt-1 text-xs">
            (ร้าน {orgName} — สินค้าที่ไม่มีบาร์โค้ด/SKU จะพิมพ์ป้ายไม่ได้
            ไปสร้างบาร์โค้ดอัตโนมัติได้ที่หน้ารายการสินค้า)
          </div>
        </div>
      )}
    </div>
  );
}
