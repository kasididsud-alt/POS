"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActiveBranch } from "@/app/(app)/branch-actions";
import type { Branch } from "@/lib/types";

/**
 * ตัวเลือกสาขาบน topbar
 * - owner + มี >1 สาขา → dropdown สลับสาขาที่กำลังดู
 * - พนักงาน / มีสาขาเดียว → badge แสดงสาขาปัจจุบันแบบอ่านอย่างเดียว
 */
export default function BranchSwitcher({
  branches,
  currentBranchId,
  canSwitch,
}: {
  branches: Branch[];
  currentBranchId: string | null;
  canSwitch: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const current = branches.find((b) => b.id === currentBranchId);

  if (!branches.length) return null;

  if (!canSwitch || branches.length < 2) {
    if (!current) return null;
    return (
      <span className="hidden items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-sm text-slate-600 sm:inline-flex">
        🏬 {current.name}
      </span>
    );
  }

  return (
    <select
      value={currentBranchId ?? ""}
      disabled={pending}
      aria-label="เลือกสาขาที่กำลังดู"
      onChange={(e) => {
        const id = e.target.value;
        startTransition(async () => {
          await setActiveBranch(id);
          router.refresh();
        });
      }}
      className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm disabled:opacity-60"
    >
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          🏬 {b.name}
        </option>
      ))}
    </select>
  );
}
