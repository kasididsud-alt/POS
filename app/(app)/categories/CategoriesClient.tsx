"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { saveCategory, deleteCategory } from "./actions";

type Cat = { id: string; name: string; product_count: number };

export default function CategoriesClient({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<Cat | null>(null);
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
          <h1 className="text-2xl font-bold">หมวดหมู่สินค้า</h1>
          <p className="text-sm text-[var(--muted)]">
            ทั้งหมด {categories.length} หมวด
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="btn-primary"
        >
          + เพิ่มหมวด
        </button>
      </div>

      <div className="card mt-4 divide-y divide-[var(--border)]">
        {categories.length === 0 && (
          <p className="p-10 text-center text-sm text-[var(--muted)]">
            ยังไม่มีหมวดหมู่
          </p>
        )}
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-4">
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-[var(--muted)]">
                {c.product_count} สินค้า
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setEditing(c);
                  setShowForm(true);
                }}
                className="btn-ghost px-2 py-1 text-xs"
              >
                แก้ไข
              </button>
              <button
                onClick={() => {
                  if (
                    confirm(
                      `ลบหมวด "${c.name}"? สินค้าในหมวดจะกลายเป็น "ไม่ระบุหมวด"`,
                    )
                  )
                    run(() => deleteCategory(c.id), () => {});
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
        title={editing ? "แก้ไขหมวด" : "เพิ่มหมวด"}
      >
        <form
          action={(fd) => run(() => saveCategory(fd), () => setShowForm(false))}
          className="space-y-3"
        >
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div>
            <label className="label">ชื่อหมวด *</label>
            <input name="name" required defaultValue={editing?.name} className="input" />
          </div>
          <button disabled={pending} type="submit" className="btn-primary w-full">
            {pending ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
