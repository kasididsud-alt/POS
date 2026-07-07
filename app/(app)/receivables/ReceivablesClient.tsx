"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { formatTHB, formatDate } from "@/lib/format";
import type { Customer } from "@/lib/types";
import type { DebtRow } from "./page";
import { addDebt, recordPayment, deleteDebt } from "./actions";

export default function ReceivablesClient({
  debts,
  customers,
}: {
  debts: DebtRow[];
  customers: Customer[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalOutstanding = debts
    .filter((d) => d.status === "open")
    .reduce((s, d) => s + (Number(d.amount) - Number(d.paid)), 0);

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

  function pay(d: DebtRow) {
    const remaining = Number(d.amount) - Number(d.paid);
    const input = prompt(`รับชำระเท่าไหร่? (ค้าง ${remaining})`, String(remaining));
    if (input == null) return;
    const amt = Number(input);
    if (!amt || amt <= 0) return;
    run(() => recordPayment(d.id, amt));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ลูกหนี้ / เครดิต</h1>
          <p className="text-sm text-[var(--muted)]">
            ยอดค้างรวม{" "}
            <span className="font-semibold text-red-600">
              {formatTHB(totalOutstanding)}
            </span>
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + บันทึกหนี้
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
              <th className="px-4 py-3">ลูกค้า</th>
              <th className="px-4 py-3 text-right">ยอดหนี้</th>
              <th className="px-4 py-3 text-right">ชำระแล้ว</th>
              <th className="px-4 py-3 text-right">คงค้าง</th>
              <th className="px-4 py-3">ครบกำหนด</th>
              <th className="px-4 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {debts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">
                  ยังไม่มีรายการ
                </td>
              </tr>
            )}
            {debts.map((d) => {
              const remaining = Number(d.amount) - Number(d.paid);
              return (
                <tr key={d.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{d.customer_name || "ไม่ระบุ"}</div>
                    {d.note && (
                      <div className="text-xs text-[var(--muted)]">{d.note}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{formatTHB(Number(d.amount))}</td>
                  <td className="px-4 py-3 text-right text-green-600">
                    {formatTHB(Number(d.paid))}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {d.status === "paid" ? (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
                        ชำระครบ
                      </span>
                    ) : (
                      <span className="text-red-600">{formatTHB(remaining)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {d.due_date ? formatDate(d.due_date) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {d.status === "open" && (
                        <button
                          onClick={() => pay(d)}
                          disabled={pending}
                          className="btn-primary px-2 py-1 text-xs"
                        >
                          รับชำระ
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm("ลบรายการนี้?")) run(() => deleteDebt(d.id));
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

      <Modal open={showForm} onClose={() => setShowForm(false)} title="บันทึกหนี้ (ขายเชื่อ)">
        <form
          action={(fd) => run(() => addDebt(fd), () => setShowForm(false))}
          className="space-y-3"
        >
          <div>
            <label className="label">ลูกค้า</label>
            <select name="customer_id" className="input">
              <option value="">— ไม่ระบุ —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">ยอดหนี้ (บาท) *</label>
            <input name="amount" type="number" step="0.01" required className="input" />
          </div>
          <div>
            <label className="label">ครบกำหนดชำระ</label>
            <input name="due_date" type="date" className="input" />
          </div>
          <div>
            <label className="label">หมายเหตุ</label>
            <input name="note" className="input" />
          </div>
          <button disabled={pending} type="submit" className="btn-primary w-full">
            บันทึก
          </button>
        </form>
      </Modal>
    </div>
  );
}
