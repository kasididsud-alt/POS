"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import type { LocationRow } from "./page";
import { saveLocation, deleteLocation } from "./actions";

export default function LocationsClient({
  locations,
}: {
  locations: LocationRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<LocationRow | null>(null);
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
          <h1 className="text-2xl font-bold">ตำแหน่งจัดเก็บ</h1>
          <p className="text-sm text-[var(--muted)]">
            {locations.length} ตำแหน่ง · โซน / ชั้นวาง / ช่องเก็บ (bin)
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="btn-primary"
        >
          + เพิ่มตำแหน่ง
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {locations.length === 0 && (
          <p className="text-sm text-[var(--muted)]">ยังไม่มีตำแหน่งจัดเก็บ</p>
        )}
        {locations.map((l) => (
          <div key={l.id} className="card p-4">
            <div className="flex items-start justify-between">
              <div className="font-mono text-lg font-semibold">{l.code}</div>
              <span className="text-xl">🗺️</span>
            </div>
            {l.zone && <div className="text-sm text-[var(--muted)]">โซน {l.zone}</div>}
            {l.note && <div className="text-xs text-[var(--muted)]">{l.note}</div>}
            <div className="mt-3 flex gap-1">
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
                  if (confirm(`ลบ "${l.code}"?`))
                    run(() => deleteLocation(l.id), () => {});
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
        title={editing ? "แก้ไขตำแหน่ง" : "เพิ่มตำแหน่ง"}
      >
        <form
          action={(fd) => run(() => saveLocation(fd), () => setShowForm(false))}
          className="space-y-3"
        >
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div>
            <label className="label">รหัสตำแหน่ง * (เช่น A-01-03)</label>
            <input name="code" required defaultValue={editing?.code} className="input" />
          </div>
          <div>
            <label className="label">โซน</label>
            <input name="zone" defaultValue={editing?.zone ?? ""} className="input" />
          </div>
          <div>
            <label className="label">หมายเหตุ</label>
            <input name="note" defaultValue={editing?.note ?? ""} className="input" />
          </div>
          <button disabled={pending} type="submit" className="btn-primary w-full">
            บันทึก
          </button>
        </form>
      </Modal>
    </div>
  );
}
