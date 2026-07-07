"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { formatDate } from "@/lib/format";
import type { LotRow } from "./page";
import { saveLot, deleteLot } from "./actions";

function daysLeft(expiry: string | null): number | null {
  if (!expiry) return null;
  const ms = new Date(expiry).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

export default function LotsClient({
  lots,
  products,
}: {
  lots: LotRow[];
  products: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<LotRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, after: () => void) {
    setError(null);
    start(async () => {
      const res = await action();
      if (!res.ok) setError(res.error ?? "ผิดพลาด");
      else {
        after();
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lot &amp; วันหมดอายุ</h1>
          <p className="text-sm text-[var(--muted)]">{lots.length} ล็อต</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="btn-primary"
        >
          + เพิ่มล็อต
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
              <th className="px-4 py-3">สินค้า</th>
              <th className="px-4 py-3">Lot</th>
              <th className="px-4 py-3 text-right">จำนวน</th>
              <th className="px-4 py-3">หมดอายุ</th>
              <th className="px-4 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {lots.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[var(--muted)]">
                  ยังไม่มีล็อต
                </td>
              </tr>
            )}
            {lots.map((l) => {
              const dl = daysLeft(l.expiry_date);
              const danger = dl !== null && dl <= 30;
              return (
                <tr key={l.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 font-medium">{l.product_name || "—"}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{l.lot_no || "—"}</td>
                  <td className="px-4 py-3 text-right">{l.qty}</td>
                  <td className="px-4 py-3">
                    {l.expiry_date ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          danger ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {formatDate(l.expiry_date)}
                        {dl !== null &&
                          (dl < 0 ? " (หมดอายุ)" : danger ? ` (อีก ${dl} วัน)` : "")}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => {
                          setEditing(l);
                          setShowForm(true);
                        }}
                        className="btn-ghost px-2 py-1 text-xs"
                      >
                        แก้ไข
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("ลบล็อตนี้?")) run(() => deleteLot(l.id), () => {});
                        }}
                        className="btn-ghost px-2 py-1 text-xs text-red-600"
                      >
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "แก้ไขล็อต" : "เพิ่มล็อต"}
      >
        <form
          action={(fd) => run(() => saveLot(fd), () => setShowForm(false))}
          className="space-y-3"
        >
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div>
            <label className="label">สินค้า *</label>
            <select
              name="product_id"
              required
              defaultValue={editing?.product_id ?? ""}
              className="input"
            >
              <option value="">เลือกสินค้า...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Lot / Serial</label>
              <input name="lot_no" defaultValue={editing?.lot_no ?? ""} className="input" />
            </div>
            <div>
              <label className="label">จำนวน</label>
              <input
                name="qty"
                type="number"
                defaultValue={editing?.qty ?? 0}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label">วันหมดอายุ</label>
            <input
              name="expiry_date"
              type="date"
              defaultValue={editing?.expiry_date ?? ""}
              className="input"
            />
          </div>
          <button disabled={pending} type="submit" className="btn-primary w-full">
            บันทึก
          </button>
        </form>
      </Modal>
    </div>
  );
}
