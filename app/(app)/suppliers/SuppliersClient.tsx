"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import type { Supplier } from "@/lib/types";
import { saveSupplier, deleteSupplier } from "./actions";

export default function SuppliersClient({
  suppliers,
}: {
  suppliers: Supplier[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.phone?.toLowerCase().includes(q),
    );
  }, [suppliers, search]);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ซัพพลายเออร์</h1>
          <p className="text-sm text-[var(--muted)]">
            ทั้งหมด {suppliers.length} ราย
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="btn-primary"
        >
          + เพิ่มซัพพลายเออร์
        </button>
      </div>

      <input
        className="input mt-4 max-w-sm"
        placeholder="ค้นหาชื่อ / เบอร์"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">ชื่อ</th>
              <th className="px-4 py-3">ติดต่อ</th>
              <th className="px-4 py-3">ที่อยู่</th>
              <th className="px-4 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-[var(--muted)]">
                  ยังไม่มีซัพพลายเออร์
                </td>
              </tr>
            )}
            {filtered.map((s) => (
              <tr key={s.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {s.phone || s.email || "—"}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">{s.address || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => {
                        setEditing(s);
                        setShowForm(true);
                      }}
                      className="btn-ghost px-2 py-1 text-xs"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`ลบ "${s.name}"?`))
                          run(() => deleteSupplier(s.id), () => {});
                      }}
                      className="btn-ghost px-2 py-1 text-xs text-red-600"
                    >
                      ลบ
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "แก้ไขซัพพลายเออร์" : "เพิ่มซัพพลายเออร์"}
      >
        <form
          action={(fd) => run(() => saveSupplier(fd), () => setShowForm(false))}
          className="space-y-3"
        >
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div>
            <label className="label">ชื่อ *</label>
            <input name="name" required defaultValue={editing?.name} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">เบอร์โทร</label>
              <input name="phone" defaultValue={editing?.phone ?? ""} className="input" />
            </div>
            <div>
              <label className="label">อีเมล</label>
              <input name="email" defaultValue={editing?.email ?? ""} className="input" />
            </div>
          </div>
          <div>
            <label className="label">ที่อยู่</label>
            <input name="address" defaultValue={editing?.address ?? ""} className="input" />
          </div>
          <div>
            <label className="label">หมายเหตุ</label>
            <input name="note" defaultValue={editing?.note ?? ""} className="input" />
          </div>
          <button disabled={pending} type="submit" className="btn-primary w-full">
            {pending ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
