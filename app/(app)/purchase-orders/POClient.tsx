"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { formatTHB, formatDateTime } from "@/lib/format";
import type { Supplier } from "@/lib/types";
import type { PORow } from "./page";
import { createPO, receivePO, cancelPO } from "./actions";

type ProductLite = { id: string; name: string; cost: number; qty: number };
type Line = { product_id: string; qty: number; unit_cost: number };

const STATUS: Record<string, { label: string; cls: string }> = {
  ordered: { label: "สั่งแล้ว", cls: "bg-amber-50 text-amber-700" },
  received: { label: "รับเข้าแล้ว", cls: "bg-green-50 text-green-700" },
  cancelled: { label: "ยกเลิก", cls: "bg-slate-100 text-slate-500" },
  draft: { label: "ร่าง", cls: "bg-slate-100 text-slate-500" },
};

export default function POClient({
  products,
  suppliers,
  pos,
}: {
  products: ProductLite[];
  suppliers: Supplier[];
  pos: PORow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { product_id: "", qty: 1, unit_cost: 0 },
  ]);
  const [error, setError] = useState<string | null>(null);

  const total = lines.reduce((s, l) => s + l.qty * l.unit_cost, 0);

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function pickProduct(i: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    updateLine(i, { product_id: productId, unit_cost: p ? p.cost : 0 });
  }

  function run(action: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    start(async () => {
      const res = await action();
      if (!res.ok) setError(res.error ?? "ผิดพลาด");
      else {
        after?.();
        router.refresh();
      }
    });
  }

  function submitPO() {
    run(
      () =>
        createPO({
          supplier_id: supplierId || null,
          note: note || null,
          items: lines.filter((l) => l.product_id && l.qty > 0),
        }),
      () => {
        setShowForm(false);
        setLines([{ product_id: "", qty: 1, unit_cost: 0 }]);
        setSupplierId("");
        setNote("");
      },
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ใบสั่งซื้อ (PO)</h1>
          <p className="text-sm text-[var(--muted)]">{pos.length} ใบ</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + สร้าง PO
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">เลขที่</th>
              <th className="px-4 py-3">ผู้ขาย</th>
              <th className="px-4 py-3 text-right">ยอดรวม</th>
              <th className="px-4 py-3 text-center">สถานะ</th>
              <th className="px-4 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {pos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[var(--muted)]">
                  ยังไม่มีใบสั่งซื้อ
                </td>
              </tr>
            )}
            {pos.map((po) => {
              const st = STATUS[po.status] ?? STATUS.draft;
              return (
                <tr key={po.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{po.po_no}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {formatDateTime(po.created_at)} · {po.items} รายการ
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {po.supplier_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">{formatTHB(Number(po.total))}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${st.cls}`}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {po.status === "ordered" && (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => run(() => receivePO(po.id))}
                          disabled={pending}
                          className="btn-primary px-2 py-1 text-xs"
                        >
                          รับเข้า
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`ยกเลิก ${po.po_no}?`))
                              run(() => cancelPO(po.id));
                          }}
                          className="btn-ghost px-2 py-1 text-xs text-red-600"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="สร้างใบสั่งซื้อ">
        <div className="space-y-3">
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
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_60px_80px_24px] gap-2">
                <select
                  className="input"
                  value={l.product_id}
                  onChange={(e) => pickProduct(i, e.target.value)}
                >
                  <option value="">เลือกสินค้า...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  className="input text-right"
                  value={l.qty}
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
                <button
                  onClick={() =>
                    setLines((prev) =>
                      prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev,
                    )
                  }
                  className="text-red-500"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setLines((p) => [...p, { product_id: "", qty: 1, unit_cost: 0 }])
              }
              className="text-sm text-[var(--primary)]"
            >
              + เพิ่มรายการ
            </button>
          </div>
          <div>
            <label className="label">หมายเหตุ</label>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
            <span className="font-bold">รวม {formatTHB(total)}</span>
            <button onClick={submitPO} disabled={pending} className="btn-primary">
              {pending ? "กำลังบันทึก..." : "สร้าง PO"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
