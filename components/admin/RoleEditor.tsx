"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMemberRole } from "@/app/(admin)/admin/actions";

export default function RoleEditor({
  orgId,
  userId,
  role,
}: {
  orgId: string;
  userId: string;
  role: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function change(next: string) {
    if (next === role) return;
    setErr(null);
    start(async () => {
      const res = await setMemberRole(orgId, userId, next as "owner" | "cashier");
      if (!res.ok) setErr(res.error ?? "ผิดพลาด");
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={role}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
        className="input w-32 py-1.5"
      >
        <option value="owner">เจ้าของ</option>
        <option value="cashier">พนักงาน</option>
      </select>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
