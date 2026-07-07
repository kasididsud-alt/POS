"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatTHB, formatDateTime } from "@/lib/format";
import type { Supplier } from "@/lib/types";
import { receiveGoods } from "./actions";

type ProductLite = {
  id: string;
  name: string;
  cost: number;
  unit: string;
  qty: number;
};
type RecentReceipt = {
  id: string;
  ref_no: string | null;
  total_cost: number;
  created_at: string;
  supplier_name: string | null;
  items: number;
};
type Line = { product_id: string; qty: number; unit_cost: number };

export default function ReceiveClient({
  products,
  suppliers,
  recent,
}: {
  products: ProductLite[];
  suppliers: Supplier[];
  recent: RecentReceipt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [supplierId, setSupplierId] = useState("");
  const [refNo, setRefNo] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { product_id: "", qty: 1, unit_cost: 0 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const total = lines.reduce((s, l) => s + l.qty * l.unit_cost, 0);

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function pickProduct(i: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    updateLine(i, { product_id: productId, unit_cost: p ? p.cost : 0 });
  }

  function submit() {
    setError(null);
    setOk(false);
    start(async () => {
      const res = await receiveGoods({
        supplier_id: supplierId || null,
        ref_no: refNo || null,
        note: note || null,
        items: lines.filter((l) => l.product_id && l.qty > 0),
      });
      if (!res.ok) setError(res.error ?? "บันทึกไม่สำเร็จ");
      else {
        setOk(true);
        setLines([{ product_id: "", qty: 1, unit_cost: 0 }]);
        setRefNo("");
        setNote("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">รับสินค้าเข้า</h1>

      <div className="card p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">ซัพพลายเออร์</label>
            <select
              className="input"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">— ไม่ระบุ —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">เลขที่อ้างอิง</label>
            <input
              className="input"
              value={refNo}
              onChange={(e) => setRefNo(e.target.value)}
              placeholder="เช่น INV-001"
            />
          </div>
          <div>
            <label className="label">หมายเหตุ</label>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="hidden gap-2 text-xs text-[var(--muted)] sm:grid sm:grid-cols-[1fr_90px_110px_110px_40px]">
            <span>สินค้า</span>
            <span className="text-right">จำนวน</span>
            <span className="text-right">ทุน/หน่วย</span>
            <span className="text-right">รวม</span>
            <span />
          </div>
          {lines.map((l, i) => (
            <div
              key={i}
              className="grid gap-2 sm:grid-cols-[1fr_90px_110px_110px_40px]"
            >
              <select
                className="input"
                value={l.product_id}
                onChange={(e) => pickProduct(i, e.target.value)}
              >
                <option value="">เลือกสินค้า...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (เหลือ {p.qty})
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="input text-right"
                value={l.qty}
                min={1}
                onChange={(e) => updateLine(i, { qty: parseInt(e.target.value) || 0 })}
              />
              <input
                type="number"
                step="0.01"
                className="input text-right"
                value={l.unit_cost}
                onChange={(e) =>
                  updateLine(i, { unit_cost: parseFloat(e.target.value) || 0 })
                }
              />
              <div className="flex items-center justify-end text-sm font-medium">
                {formatTHB(l.qty * l.unit_cost)}
              </div>
              <button
                onClick={() =>
                  setLines((prev) =>
                    prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev,
                  )
                }
                className="text-red-500 hover:text-red-700"
                title="ลบแถว"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() =>
            setLines((prev) => [...prev, { product_id: "", qty: 1, unit_cost: 0 }])
          }
          className="btn-ghost mt-2 text-sm text-[var(--primary)]"
        >
          + เพิ่มรายการ
        </button>

        <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4">
          <div className="text-lg font-bold">
            รวมต้นทุน: {formatTHB(total)}
          </div>
          <button onClick={submit} disabled={pending} className="btn-primary">
            {pending ? "กำลังบันทึก..." : "บันทึกรับเข้า"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {ok && <p className="mt-3 text-sm text-green-600">✅ รับสินค้าเข้าคลังแล้ว</p>}
      </div>

      <div className="card p-5">
        <h2 className="font-semibold">รับเข้าล่าสุด</h2>
        <div className="mt-3 space-y-2">
          {recent.length === 0 && (
            <p className="text-sm text-[var(--muted)]">ยังไม่มีประวัติ</p>
          )}
          {recent.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium">{r.ref_no || "ไม่มีเลขอ้างอิง"}</span>
                <span className="text-[var(--muted)]">
                  {" "}
                  · {r.supplier_name || "ไม่ระบุผู้ขาย"} · {r.items} รายการ
                </span>
                <div className="text-xs text-[var(--muted)]">
                  {formatDateTime(r.created_at)}
                </div>
              </div>
              <span className="font-medium">{formatTHB(Number(r.total_cost))}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
