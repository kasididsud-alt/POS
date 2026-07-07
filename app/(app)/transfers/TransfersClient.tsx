"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { formatDateTime } from "@/lib/format";
import type { TransferRow } from "./page";
import { createTransfer, setTransferStatus } from "./actions";

type ProductLite = { id: string; name: string; qty: number };
type Branch = { id: string; name: string; type: string };
type Line = { product_id: string; qty: number };

const STATUS: Record<string, { label: string; cls: string }> = {
  in_transit: { label: "ระหว่างทาง", cls: "bg-amber-50 text-amber-700" },
  received: { label: "รับแล้ว", cls: "bg-green-50 text-green-700" },
  cancelled: { label: "ยกเลิก", cls: "bg-slate-100 text-slate-500" },
};

export default function TransfersClient({
  products,
  branches,
  transfers,
}: {
  products: ProductLite[];
  branches: Branch[];
  transfers: TransferRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([{ product_id: "", qty: 1 }]);
  const [error, setError] = useState<string | null>(null);

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
        createTransfer({
          from_branch_id: from,
          to_branch_id: to,
          note: note || null,
          items: lines
            .filter((l) => l.product_id && l.qty > 0)
            .map((l) => ({
              product_id: l.product_id,
              name: products.find((p) => p.id === l.product_id)?.name ?? "",
              qty: l.qty,
            })),
        }),
      () => {
        setShowForm(false);
        setLines([{ product_id: "", qty: 1 }]);
        setFrom("");
        setTo("");
        setNote("");
      },
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">โอนย้ายคลัง / สาขา</h1>
          <p className="text-sm text-[var(--muted)]">{transfers.length} รายการ</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={branches.length < 2}
          className="btn-primary"
          title={branches.length < 2 ? "ต้องมีอย่างน้อย 2 สาขา/คลัง" : ""}
        >
          + สร้างใบโอน
        </button>
      </div>

      {branches.length < 2 && (
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ต้องมีอย่างน้อย 2 สาขา/คลังก่อน — เพิ่มได้ที่เมนู “สาขา/คลัง”
        </div>
      )}
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
              <th className="px-4 py-3">เส้นทาง</th>
              <th className="px-4 py-3 text-center">สถานะ</th>
              <th className="px-4 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {transfers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-[var(--muted)]">
                  ยังไม่มีใบโอน
                </td>
              </tr>
            )}
            {transfers.map((t) => {
              const st = STATUS[t.status] ?? STATUS.in_transit;
              return (
                <tr key={t.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{t.transfer_no}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {formatDateTime(t.created_at)} · {t.items} รายการ
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {t.from_name || "—"} → {t.to_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${st.cls}`}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {t.status === "in_transit" && (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => run(() => setTransferStatus(t.id, "received"))}
                          disabled={pending}
                          className="btn-primary px-2 py-1 text-xs"
                        >
                          รับเข้า
                        </button>
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                `ยกเลิก ${t.transfer_no}? สต็อกจะถูกคืนกลับสาขาต้นทาง`,
                              )
                            )
                              run(() => setTransferStatus(t.id, "cancelled"));
                          }}
                          disabled={pending}
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

      <Modal open={showForm} onClose={() => setShowForm(false)} title="สร้างใบโอน">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">จาก</label>
              <select className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
                <option value="">เลือก...</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">ไปยัง</label>
              <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="">เลือก...</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_70px_24px] gap-2">
                <select
                  className="input"
                  value={l.product_id}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((x, idx) =>
                        idx === i ? { ...x, product_id: e.target.value } : x,
                      ),
                    )
                  }
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
                  min={1}
                  className="input text-right"
                  value={l.qty}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((x, idx) =>
                        idx === i ? { ...x, qty: parseInt(e.target.value) || 0 } : x,
                      ),
                    )
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
              onClick={() => setLines((p) => [...p, { product_id: "", qty: 1 }])}
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
          <button onClick={submit} disabled={pending} className="btn-primary w-full">
            {pending ? "กำลังบันทึก..." : "สร้างใบโอน"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
