"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOrgPlan, extendTrial } from "@/app/(admin)/admin/actions";

type Msg = { ok: boolean; text: string };
type PlanChoice = "free" | "pro" | "premium";

const PLAN_OPTIONS: { id: PlanChoice; label: string; title: string }[] = [
  { id: "free", label: "ฟรี", title: "ปรับร้านเป็นฟรีจริง (ตัด trial/comp ทิ้ง)" },
  { id: "pro", label: "Pro", title: "แถมสิทธิ์ Pro (comp — ไม่ผ่าน Stripe)" },
  {
    id: "premium",
    label: "Premium",
    title: "แถมสิทธิ์ Premium (comp — ไม่ผ่าน Stripe)",
  },
];

const PLAN_LABEL: Record<PlanChoice, string> = {
  free: "ฟรี",
  pro: "Pro",
  premium: "Premium",
};

/**
 * แผงจัดการร้านแบบย่อ ใช้ฝังในแถวตาราง
 * เลือกระดับ/ใส่จำนวนวันเป็น "ร่าง" ก่อน — มีผลจริงเมื่อกดบันทึกเท่านั้น (กันมือลั่น)
 * ปุ่มระดับที่ทึบ = ระดับที่มีผลจริงตอนนี้
 */
export default function OrgQuickManage({
  orgId,
  plan,
  compPlan,
}: {
  orgId: string;
  /** ระดับที่มีผลจริงของร้าน (derive แล้ว) */
  plan: string;
  compPlan: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg | null>(null);
  // ร่างการแก้ไข — null/0 = ไม่เปลี่ยนส่วนนั้น
  const [draftPlan, setDraftPlan] = useState<PlanChoice | "clear" | null>(null);
  const [days, setDays] = useState(0);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    },
    [],
  );

  const planDirty = draftPlan !== null && draftPlan !== plan;
  const daysDirty = Number.isFinite(days) && days > 0;
  const dirty = planDirty || daysDirty;

  function resetDraft() {
    setDraftPlan(null);
    setDays(0);
    setMsg(null);
  }

  function togglePlan(p: PlanChoice | "clear") {
    setMsg(null);
    // เลือกซ้ำ = ถอนร่าง, เลือกระดับที่เป็นอยู่แล้ว = ไม่ต้องร่าง
    setDraftPlan((cur) => (cur === p || p === plan ? null : p));
  }

  function save() {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setMsg(null);
    start(async () => {
      const parts: string[] = [];
      if (planDirty && draftPlan) {
        const res = await setOrgPlan(orgId, draftPlan);
        if (!res.ok) {
          setMsg({ ok: false, text: res.error ?? "ผิดพลาด" });
          return;
        }
        parts.push(res.message ?? "เปลี่ยนระดับแล้ว");
      }
      if (daysDirty) {
        const res = await extendTrial(orgId, days);
        if (!res.ok) {
          setMsg({ ok: false, text: res.error ?? "ผิดพลาด" });
          return;
        }
        parts.push(res.message ?? "เพิ่มวันแล้ว");
      }
      setDraftPlan(null);
      setDays(0);
      setMsg({ ok: true, text: parts.join(" · ") });
      dismissTimer.current = setTimeout(() => setMsg(null), 6000);
      router.refresh();
    });
  }

  // ป้ายสรุปว่ากดบันทึกแล้วจะเกิดอะไร
  const pendingChanges: string[] = [];
  if (planDirty && draftPlan === "clear")
    pendingChanges.push("ยกเลิก comp (กลับไปคิดตามจริง)");
  else if (planDirty && draftPlan)
    pendingChanges.push(`เปลี่ยนระดับเป็น ${PLAN_LABEL[draftPlan as PlanChoice]}`);
  if (daysDirty) pendingChanges.push(`เพิ่มวันทดลองใช้ ${days} วัน`);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* เลือกระดับแพ็กเกจ (ร่าง) */}
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--border)]">
          {PLAN_OPTIONS.map((p) => {
            const isCurrent = plan === p.id;
            const isDraft = draftPlan === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={pending}
                title={p.title}
                onClick={() => togglePlan(p.id)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${
                  isCurrent
                    ? "bg-[var(--primary)] text-white"
                    : isDraft
                      ? "bg-indigo-50 text-[var(--primary)] ring-2 ring-inset ring-[var(--primary)]"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        {compPlan && (
          <button
            type="button"
            disabled={pending}
            title="ยกเลิก comp — กลับไปคิดตาม subscription จริง"
            onClick={() => togglePlan("clear")}
            className={`rounded-lg px-2 py-1 text-xs disabled:opacity-50 ${
              draftPlan === "clear"
                ? "bg-indigo-50 text-[var(--primary)] ring-2 ring-inset ring-[var(--primary)]"
                : "text-[var(--muted)] hover:bg-slate-100"
            }`}
          >
            ✕ ยกเลิก comp
          </button>
        )}

        {/* เพิ่มวันทดลองใช้ (ร่าง) */}
        <label className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
          +
          <input
            type="number"
            min={0}
            max={365}
            value={days === 0 ? "" : days}
            placeholder="0"
            disabled={pending}
            onChange={(e) => {
              setMsg(null);
              setDays(Math.max(0, Math.floor(Number(e.target.value) || 0)));
            }}
            className="w-14 rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-xs tabular-nums text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
            aria-label="จำนวนวันทดลองใช้ที่จะเพิ่ม"
          />
          วัน
        </label>

        {/* บันทึก/ยกเลิก — โผล่เฉพาะตอนมีร่างค้าง */}
        {dirty && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={save}
              className="rounded-lg bg-[var(--primary)] px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "กำลังบันทึก…" : "บันทึก"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={resetDraft}
              className="rounded-lg px-2 py-1 text-xs text-[var(--muted)] hover:bg-slate-100 disabled:opacity-50"
            >
              ยกเลิก
            </button>
          </>
        )}
      </div>

      {dirty && !msg && (
        <p className="text-xs text-amber-700">
          ยังไม่บันทึก — จะ{pendingChanges.join(" และ ")}
        </p>
      )}

      {msg && (
        <p
          className={`text-xs ${msg.ok ? "text-green-600" : "text-red-600"}`}
          role="status"
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
