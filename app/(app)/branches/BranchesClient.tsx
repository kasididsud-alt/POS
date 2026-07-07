"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import type { Branch } from "./page";
import { saveBranch, deleteBranch } from "./actions";

export default function BranchesClient({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<Branch | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    after: () => void,
  ) {
    setError(null);
    start(async () => {
      const res = await action();
      if (!res.ok) setError(res.error ?? "เกิดข้อผิดพลาด");
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
          <h1 className="text-2xl font-bold">สาขา / คลัง</h1>
          <p className="text-sm text-[var(--muted)]">
            จัดการหลายสาขาและคลังภายใต้ร้านเดียว
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="btn-primary"
        >
          + เพิ่มสาขา/คลัง
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches.length === 0 && (
          <p className="text-sm text-[var(--muted)]">
            ยังไม่มีสาขา — เพิ่มสาขาแรกเพื่อเริ่มจัดการหลายจุดขาย
          </p>
        )}
        {branches.map((b) => (
          <div key={b.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div className="text-2xl">{b.type === "warehouse" ? "🏭" : "🏪"}</div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                {b.type === "warehouse" ? "คลัง" : "หน้าร้าน"}
              </span>
            </div>
            <div className="mt-2 font-semibold">{b.name}</div>
            <div className="text-xs text-[var(--muted)]">
              {b.address || "ไม่ระบุที่อยู่"}
            </div>
            {b.phone && (
              <div className="text-xs text-[var(--muted)]">📞 {b.phone}</div>
            )}
            <div className="mt-3 flex gap-1">
              <button
                onClick={() => {
                  setEditing(b);
                  setShowForm(true);
                }}
                className="btn-ghost px-2 py-1 text-xs"
              >
                แก้ไข
              </button>
              <button
                onClick={() => {
                  if (confirm(`ลบ "${b.name}"?`))
                    run(() => deleteBranch(b.id), () => {});
                }}
                className="btn-ghost px-2 py-1 text-xs text-red-600"
              >
                ลบ
              </button>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "แก้ไขสาขา/คลัง" : "เพิ่มสาขา/คลัง"}
      >
        <form
          action={(fd) => run(() => saveBranch(fd), () => setShowForm(false))}
          className="space-y-3"
        >
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div>
            <label className="label">ชื่อ *</label>
            <input name="name" required defaultValue={editing?.name} className="input" />
          </div>
          <div>
            <label className="label">ประเภท</label>
            <select name="type" className="input" defaultValue={editing?.type ?? "shop"}>
              <option value="shop">หน้าร้าน</option>
              <option value="warehouse">คลังสินค้า</option>
            </select>
          </div>
          <div>
            <label className="label">ที่อยู่</label>
            <input name="address" defaultValue={editing?.address ?? ""} className="input" />
          </div>
          <div>
            <label className="label">เบอร์โทร</label>
            <input name="phone" defaultValue={editing?.phone ?? ""} className="input" />
          </div>
          <button disabled={pending} type="submit" className="btn-primary w-full">
            {pending ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
