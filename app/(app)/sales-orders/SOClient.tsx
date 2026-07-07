"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { formatTHB, formatDateTime } from "@/lib/format";
import type { Customer } from "@/lib/types";
import type { SORow } from "./page";
import { createSalesOrder, setSOStatus } from "./actions";

type ProductLite = { id: string; name: string; price: number };
type Line = { product_id: string; qty: number; unit_price: number };

const STATUS: Record<string, { label: string; cls: string; next?: string; nextLabel?: string }> = {
  open: { label: "เปิด", cls: "bg-slate-100 text-slate-600", next: "confirmed", nextLabel: "ยืนยัน" },
  confirmed: { label: "ยืนยันแล้ว", cls: "bg-amber-50 text-amber-700", next: "fulfilled", nextLabel: "ส่งมอบ" },
  fulfilled: { label: "ส่งมอบแล้ว", cls: "bg-green-50 text-green-700" },
  cancelled: { label: "ยกเลิก", cls: "bg-slate-100 text-slate-400" },
};

export default function SOClient({
  products,
  customers,
  orders,
}: {
  products: ProductLite[];
  customers: Customer[];
  orders: SORow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([{ product_id: "", qty: 1, unit_price: 0 }]);
  const [error, setError] = useState<string | null>(null);

  const total = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function pick(i: number, pid: string) {
    const p = products.find((x) => x.id === pid);
    updateLine(i, { product_id: pid, unit_price: p ? p.price : 0 });
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

  function submit() {
    run(
      () =>
        createSalesOrder({
          customer_id: customerId || null,
          note: note || null,
          items: lines
            .filter((l) => l.product_id && l.qty > 0)
            .map((l) => ({
              product_id: l.product_id,
              name: products.find((p) => p.id === l.product_id)?.name ?? "",
              unit_price: l.unit_price,
              qty: l.qty,
            })),
        }),
      () => {
        setShowForm(false);
        setLines([{ product_id: "", qty: 1, unit_price: 0 }]);
        setCustomerId("");
        setNote("");
      },
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ออเดอร์ขายส่ง</h1>
          <p className="text-sm text-[var(--muted)]">{orders.length} ออเดอร์</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + สร้างออเดอร์
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
              <th className="px-4 py-3">ลูกค้า</th>
              <th className="px-4 py-3 text-right">ยอดรวม</th>
              <th className="px-4 py-3 text-center">สถานะ</th>
              <th className="px-4 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[var(--muted)]">
                  ยังไม่มีออเดอร์ขายส่ง
                </td>
              </tr>
            )}
            {orders.map((o) => {
              const st = STATUS[o.status] ?? STATUS.open;
              return (
                <tr key={o.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{o.so_no}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {formatDateTime(o.created_at)} · {o.items} รายการ
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {o.customer_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">{formatTHB(Number(o.total))}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${st.cls}`}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {st.next && (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => run(() => setSOStatus(o.id, st.next!))}
                          disabled={pending}
                          className="btn-primary px-2 py-1 text-xs"
                        >
                          {st.nextLabel}
                        </button>
                        <button
                          onClick={() => run(() => setSOStatus(o.id, "cancelled"))}
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

      <Modal open={showForm} onClose={() => setShowForm(false)} title="สร้างออเดอร์ขายส่ง">
        <div className="space-y-3">
          <div>
            <label className="label">ลูกค้า</label>
            <select
              className="input"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">— ไม่ระบุ —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
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
                  onChange={(e) => pick(i, e.target.value)}
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
                  value={l.unit_price}
                  onChange={(e) =>
                    updateLine(i, { unit_price: parseFloat(e.target.value) || 0 })
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
                setLines((p) => [...p, { product_id: "", qty: 1, unit_price: 0 }])
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
          <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
            <span className="font-bold">รวม {formatTHB(total)}</span>
            <button onClick={submit} disabled={pending} className="btn-primary">
              {pending ? "กำลังบันทึก..." : "สร้างออเดอร์"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
