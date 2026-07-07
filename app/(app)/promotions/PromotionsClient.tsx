"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { formatTHB, formatDate } from "@/lib/format";
import type { Promotion } from "./page";
import { savePromotion, deletePromotion } from "./actions";

export default function PromotionsClient({
  promotions,
}: {
  promotions: Promotion[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<Promotion | null>(null);
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

  function discountLabel(p: Promotion) {
    return p.type === "percent" ? `ลด ${p.value}%` : `ลด ${formatTHB(Number(p.value))}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">โปรโมชั่น / ส่วนลด</h1>
          <p className="text-sm text-[var(--muted)]">{promotions.length} โปรโมชั่น</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="btn-primary"
        >
          + เพิ่มโปรโมชั่น
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {promotions.length === 0 && (
          <p className="text-sm text-[var(--muted)]">ยังไม่มีโปรโมชั่น</p>
        )}
        {promotions.map((p) => (
          <div key={p.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div className="text-2xl">🎯</div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  p.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {p.is_active ? "เปิดใช้" : "ปิด"}
              </span>
            </div>
            <div className="mt-2 font-semibold">{p.name}</div>
            <div className="text-sm text-[var(--primary)]">{discountLabel(p)}</div>
            {Number(p.min_purchase) > 0 && (
              <div className="text-xs text-[var(--muted)]">
                ขั้นต่ำ {formatTHB(Number(p.min_purchase))}
              </div>
            )}
            <div className="mt-1 text-xs text-[var(--muted)]">
              {p.starts_at ? formatDate(p.starts_at) : "ไม่จำกัด"} –{" "}
              {p.ends_at ? formatDate(p.ends_at) : "ไม่จำกัด"}
            </div>
            <div className="mt-3 flex gap-1">
              <button
                onClick={() => {
                  setEditing(p);
                  setShowForm(true);
                }}
                className="btn-ghost px-2 py-1 text-xs"
              >
                แก้ไข
              </button>
              <button
                onClick={() => {
                  if (confirm(`ลบ "${p.name}"?`))
                    run(() => deletePromotion(p.id), () => {});
                }}
                className="btn-ghost px-2 py-1 text-xs text-red-600"
              >
                ลบ
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "แก้ไขโปรโมชั่น" : "เพิ่มโปรโมชั่น"}
      >
        <form
          action={(fd) => run(() => savePromotion(fd), () => setShowForm(false))}
          className="space-y-3"
        >
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div>
            <label className="label">ชื่อโปรโมชั่น *</label>
            <input name="name" required defaultValue={editing?.name} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">ประเภท</label>
              <select name="type" className="input" defaultValue={editing?.type ?? "percent"}>
                <option value="percent">ลดเป็น %</option>
                <option value="amount">ลดเป็นบาท</option>
              </select>
            </div>
            <div>
              <label className="label">มูลค่าส่วนลด</label>
              <input
                name="value"
                type="number"
                step="0.01"
                defaultValue={editing?.value ?? 0}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label">ยอดซื้อขั้นต่ำ (บาท)</label>
            <input
              name="min_purchase"
              type="number"
              step="0.01"
              defaultValue={editing?.min_purchase ?? 0}
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">เริ่ม</label>
              <input
                name="starts_at"
                type="date"
                defaultValue={editing?.starts_at ?? ""}
                className="input"
              />
            </div>
            <div>
              <label className="label">สิ้นสุด</label>
              <input
                name="ends_at"
                type="date"
                defaultValue={editing?.ends_at ?? ""}
                className="input"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              name="is_active"
              type="checkbox"
              defaultChecked={editing ? editing.is_active : true}
            />
            เปิดใช้งาน
          </label>
          <button disabled={pending} type="submit" className="btn-primary w-full">
            {pending ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
