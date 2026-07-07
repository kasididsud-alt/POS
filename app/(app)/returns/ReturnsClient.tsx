"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatTHB, formatDateTime } from "@/lib/format";
import type { SaleWithItems } from "./page";
import { processReturn } from "./actions";

type Recent = {
  id: string;
  total_refund: number;
  reason: string | null;
  created_at: string;
  bill_no: string | null;
};

export default function ReturnsClient({
  sales,
  recent,
}: {
  sales: SaleWithItems[];
  recent: Recent[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<SaleWithItems | null>(null);
  const [qtys, setQtys] = useState<Record<number, number>>({});
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function selectSale(s: SaleWithItems) {
    setSelected(s);
    setQtys({});
    setReason("");
    setMsg(null);
  }

  const refundTotal = selected
    ? selected.items.reduce(
        (sum, it, i) => sum + (qtys[i] ?? 0) * Number(it.unit_price),
        0,
      )
    : 0;

  function submit() {
    if (!selected) return;
    setMsg(null);
    const items = selected.items
      .map((it, i) => ({
        product_id: it.product_id,
        name: it.name,
        unit_price: Number(it.unit_price),
        qty: qtys[i] ?? 0,
      }))
      .filter((it) => it.qty > 0);
    if (!items.length) {
      setMsg({ ok: false, text: "เลือกจำนวนที่จะคืนอย่างน้อย 1" });
      return;
    }
    start(async () => {
      const res = await processReturn({
        sale_id: selected.id,
        reason: reason || null,
        items,
      });
      if (!res.ok) setMsg({ ok: false, text: res.error ?? "ผิดพลาด" });
      else {
        setMsg({ ok: true, text: "✅ คืนสินค้าเรียบร้อย คืนสต็อกแล้ว" });
        setSelected(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">คืนสินค้า / คืนเงิน</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* เลือกบิล */}
        <div className="card p-5">
          <h2 className="font-semibold">เลือกบิลที่จะคืน</h2>
          <div className="mt-3 max-h-80 space-y-1 overflow-y-auto">
            {sales.length === 0 && (
              <p className="text-sm text-[var(--muted)]">ยังไม่มีบิล</p>
            )}
            {sales.map((s) => (
              <button
                key={s.id}
                onClick={() => selectSale(s)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                  selected?.id === s.id ? "bg-indigo-50" : "hover:bg-slate-50"
                }`}
              >
                <span>
                  <span className="font-medium">{s.bill_no}</span>
                  <span className="block text-xs text-[var(--muted)]">
                    {formatDateTime(s.created_at)}
                  </span>
                </span>
                <span>{formatTHB(Number(s.total))}</span>
              </button>
            ))}
          </div>
        </div>

        {/* รายการคืน */}
        <div className="card p-5">
          <h2 className="font-semibold">รายการที่จะคืน</h2>
          {!selected ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              เลือกบิลทางซ้ายก่อน
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {selected.items.map((it, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{it.name}</div>
                    <div className="text-xs text-[var(--muted)]">
                      ขายไป {it.qty} × {formatTHB(Number(it.unit_price))}
                    </div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={it.qty}
                    className="w-20 rounded border border-[var(--border)] px-2 py-1 text-right"
                    value={qtys[i] ?? ""}
                    placeholder="0"
                    onChange={(e) => {
                      const v = Math.min(
                        Math.max(0, parseInt(e.target.value) || 0),
                        it.qty,
                      );
                      setQtys((q) => ({ ...q, [i]: v }));
                    }}
                  />
                </div>
              ))}
              <div>
                <label className="label">เหตุผลการคืน</label>
                <input
                  className="input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="เช่น สินค้าชำรุด"
                />
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
                <span className="font-semibold">
                  ยอดคืน: {formatTHB(refundTotal)}
                </span>
                <button
                  onClick={submit}
                  disabled={pending || refundTotal === 0}
                  className="btn-primary"
                >
                  {pending ? "กำลังบันทึก..." : "ยืนยันคืนสินค้า"}
                </button>
              </div>
            </div>
          )}
          {msg && (
            <p
              className={`mt-3 text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}
            >
              {msg.text}
            </p>
          )}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold">ประวัติการคืนล่าสุด</h2>
        <div className="mt-3 space-y-2">
          {recent.length === 0 && (
            <p className="text-sm text-[var(--muted)]">ยังไม่มีประวัติ</p>
          )}
          {recent.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium">{r.bill_no || "—"}</span>
                <span className="text-[var(--muted)]"> · {r.reason || "ไม่ระบุ"}</span>
                <div className="text-xs text-[var(--muted)]">
                  {formatDateTime(r.created_at)}
                </div>
              </div>
              <span className="font-medium text-red-600">
                -{formatTHB(Number(r.total_refund))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
