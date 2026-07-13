"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import { inviteStaff, changeRole, removeStaff, setStaffBranch } from "./actions";
import type { Branch } from "@/lib/types";

type Member = {
  user_id: string;
  role: string;
  email: string;
  full_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  created_at: string;
};

export default function StaffClient({
  members,
  branches,
  isOwner,
  currentUserId,
}: {
  members: Member[];
  branches: Branch[];
  isOwner: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setMsg(null);
    start(async () => {
      const res = await action();
      if (!res.ok) setMsg({ ok: false, text: res.error ?? "ผิดพลาด" });
      else {
        setMsg({ ok: true, text: res.message ?? "สำเร็จ" });
        router.refresh();
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">พนักงาน & สิทธิ์</h1>
      <p className="text-sm text-[var(--muted)]">
        เจ้าของร้านจัดการทีมงานได้ — ผู้จัดการดูแลสินค้า/สต็อก/จัดซื้อ ส่วนพนักงานใช้ POS งานหน้าร้าน
      </p>

      {msg && (
        <div
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="card mt-4 divide-y divide-[var(--border)]">
        {members.map((m) => (
          <div key={m.user_id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="truncate font-medium">
                {m.full_name || m.email}
                {m.user_id === currentUserId && (
                  <span className="ml-1 text-xs text-[var(--muted)]">(คุณ)</span>
                )}
              </div>
              <div className="text-xs text-[var(--muted)]">
                {m.email} · เข้าร่วม {formatDate(m.created_at)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isOwner && branches.length > 0 ? (
                <select
                  className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm"
                  value={m.branch_id ?? ""}
                  onChange={(e) => run(() => setStaffBranch(m.user_id, e.target.value))}
                  disabled={pending}
                  aria-label="สาขาที่สังกัด"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      🏬 {b.name}
                    </option>
                  ))}
                </select>
              ) : (
                m.branch_name && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                    🏬 {m.branch_name}
                  </span>
                )
              )}
              {isOwner && m.user_id !== currentUserId ? (
                <select
                  className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm"
                  value={m.role}
                  onChange={(e) => run(() => changeRole(m.user_id, e.target.value))}
                  disabled={pending}
                >
                  <option value="owner">เจ้าของร้าน</option>
                  <option value="manager">ผู้จัดการ</option>
                  <option value="cashier">พนักงาน</option>
                </select>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                  {m.role === "owner" ? "เจ้าของร้าน" : m.role === "manager" ? "ผู้จัดการ" : "พนักงาน"}
                </span>
              )}
              {isOwner && m.user_id !== currentUserId && (
                <button
                  onClick={() => {
                    if (confirm(`นำ ${m.email} ออกจากร้าน?`))
                      run(() => removeStaff(m.user_id));
                  }}
                  className="text-xs text-red-600"
                >
                  นำออก
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {isOwner && (
        <div className="card mt-6 p-5">
          <h2 className="font-semibold">เชิญพนักงานใหม่</h2>
          <form
            action={(fd) => run(() => inviteStaff(fd))}
            className="mt-3 flex flex-wrap gap-2"
          >
            <input
              name="email"
              type="email"
              required
              placeholder="อีเมลพนักงาน"
              className="input flex-1"
            />
            <select name="role" className="input w-32" defaultValue="cashier">
              <option value="cashier">พนักงาน</option>
              <option value="manager">ผู้จัดการ</option>
              <option value="owner">เจ้าของร้าน</option>
            </select>
            <button disabled={pending} className="btn-primary">
              เชิญ
            </button>
          </form>
          <p className="mt-2 text-xs text-[var(--muted)]">
            ระบบจะสร้างบัญชีพร้อมรหัสผ่านชั่วคราวให้ (ถ้ายังไม่มีบัญชี)
          </p>
        </div>
      )}
    </div>
  );
}
