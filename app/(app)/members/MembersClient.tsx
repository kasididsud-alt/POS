"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatTHB } from "@/lib/format";
import type { MemberRow } from "./page";
import { adjustPoints } from "./actions";

function tier(points: number) {
  if (points >= 1000) return { label: "ทอง", cls: "bg-amber-100 text-amber-800" };
  if (points >= 300) return { label: "เงิน", cls: "bg-slate-200 text-slate-700" };
  return { label: "ทั่วไป", cls: "bg-slate-100 text-slate-500" };
}

export default function MembersClient({ members }: { members: MemberRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(m: MemberRow, sign: 1 | -1) {
    const input = prompt(
      `${sign > 0 ? "เพิ่ม" : "ใช้"}แต้มของ ${m.name} (ปัจจุบัน ${m.points})`,
      "10",
    );
    if (input == null) return;
    const n = Number(input);
    if (!n || n <= 0) return;
    setError(null);
    start(async () => {
      const res = await adjustPoints(m.id, sign * n);
      if (!res.ok) setError(res.error ?? "ผิดพลาด");
      else router.refresh();
    });
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold">สมาชิก / แต้มสะสม</h1>
        <p className="text-sm text-[var(--muted)]">
          ลูกค้าทั้งหมดเป็นสมาชิกได้ · ระดับ: ทั่วไป &lt; เงิน (300) &lt; ทอง (1000)
        </p>
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
              <th className="px-4 py-3">สมาชิก</th>
              <th className="px-4 py-3 text-center">ระดับ</th>
              <th className="px-4 py-3 text-right">ยอดซื้อสะสม</th>
              <th className="px-4 py-3 text-right">แต้ม</th>
              <th className="px-4 py-3 text-right">จัดการแต้ม</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[var(--muted)]">
                  ยังไม่มีสมาชิก — เพิ่มลูกค้าที่เมนู “ลูกค้า (CRM)”
                </td>
              </tr>
            )}
            {members.map((m) => {
              const t = tier(m.points);
              return (
                <tr key={m.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-[var(--muted)]">{m.phone || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${t.cls}`}>
                      {t.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatTHB(Number(m.total_spent))}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{m.points}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => change(m, 1)}
                        disabled={pending}
                        className="btn-outline px-2 py-1 text-xs"
                      >
                        + แต้ม
                      </button>
                      <button
                        onClick={() => change(m, -1)}
                        disabled={pending}
                        className="btn-ghost px-2 py-1 text-xs"
                      >
                        ใช้แต้ม
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
