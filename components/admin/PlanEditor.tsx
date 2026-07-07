"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOrgPlan, extendTrial } from "@/app/(admin)/admin/actions";

type Msg = { ok: boolean; text: string };

export default function PlanEditor({
  orgId,
  plan,
  compPlan,
  status,
  trialEndsAt,
}: {
  orgId: string;
  plan: string;
  compPlan: string | null;
  status: string | null;
  trialEndsAt: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg | null>(null);
  const [days, setDays] = useState(14);

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

  const PLANS: { id: "free" | "pro" | "premium"; label: string }[] = [
    { id: "free", label: "ฟรี" },
    { id: "pro", label: "Pro" },
    { id: "premium", label: "Premium" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-[var(--muted)]">แพ็กเกจปัจจุบัน:</span>
        <span className="font-semibold uppercase">{plan}</span>
        {compPlan ? (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
            comp = {compPlan}
          </span>
        ) : (
          <span className="text-xs text-[var(--muted)]">
            (คิดตามจริง — สถานะ {status ?? "ไม่มี subscription"})
          </span>
        )}
      </div>

      {msg && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div>
        <div className="label">ตั้งแพ็กเกจ (comp — ไม่ผ่าน Stripe)</div>
        <div className="flex flex-wrap gap-2">
          {PLANS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={pending}
              onClick={() => run(() => setOrgPlan(orgId, p.id))}
              className={`btn-outline ${
                compPlan === p.id ? "ring-2 ring-[var(--primary)]/40" : ""
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            disabled={pending || !compPlan}
            onClick={() => run(() => setOrgPlan(orgId, "clear"))}
            className="btn-ghost text-[var(--muted)]"
          >
            ยกเลิก comp
          </button>
        </div>
      </div>

      <div className="border-t border-[var(--border)] pt-4">
        <div className="label">ยืดวันทดลองใช้ (trial)</div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="input w-24"
          />
          <span className="text-sm text-[var(--muted)]">วัน</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => extendTrial(orgId, days))}
            className="btn-primary"
          >
            ยืด trial
          </button>
        </div>
        {trialEndsAt && (
          <p className="mt-1 text-xs text-[var(--muted)]">
            หมดทดลอง: {new Date(trialEndsAt).toLocaleString("th-TH")}
          </p>
        )}
      </div>
    </div>
  );
}
