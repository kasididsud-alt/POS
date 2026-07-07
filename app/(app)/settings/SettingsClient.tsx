"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Organization } from "@/lib/types";
import { updateOrg, inviteMember, removeMember } from "./actions";

type Member = { user_id: string; role: string; email: string };

export default function SettingsClient({
  org,
  members,
  isOwner,
  currentUserId,
}: {
  org: Organization;
  members: Member[];
  isOwner: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [vatOn, setVatOn] = useState(org.vat_registered);

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
    <div className="space-y-6">
      {msg && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* ข้อมูลร้าน */}
      <div className="card p-6">
        <h2 className="font-semibold">ข้อมูลร้าน</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => updateOrg(new FormData(e.currentTarget)));
          }}
          className="mt-4 space-y-3"
        >
          <div>
            <label className="label">ชื่อร้าน</label>
            <input
              name="name"
              defaultValue={org.name}
              disabled={!isOwner}
              className="input"
            />
          </div>
          <div>
            <label className="label">เบอร์พร้อมเพย์ (รับเงินหน้าร้าน)</label>
            <input
              name="promptpay_id"
              defaultValue={org.promptpay_id ?? ""}
              disabled={!isOwner}
              placeholder="เช่น 0812345678 หรือเลขบัตรประชาชน"
              className="input"
            />
          </div>
          <div className="border-t border-[var(--border)] pt-3 text-xs font-medium text-[var(--muted)]">
            ข้อมูลสำหรับใบเสร็จ / ใบกำกับภาษี
          </div>
          <div>
            <label className="label">ที่อยู่ร้าน</label>
            <input
              name="address"
              defaultValue={org.address ?? ""}
              disabled={!isOwner}
              placeholder="ที่อยู่สำหรับพิมพ์บนใบเสร็จ"
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">เบอร์โทรร้าน</label>
              <input
                name="phone"
                defaultValue={org.phone ?? ""}
                disabled={!isOwner}
                className="input"
              />
            </div>
            <div>
              <label className="label">เลขประจำตัวผู้เสียภาษี</label>
              <input
                name="tax_id"
                defaultValue={org.tax_id ?? ""}
                disabled={!isOwner}
                className="input"
              />
            </div>
          </div>

          {/* ภาษีมูลค่าเพิ่ม (VAT) */}
          <div className="rounded-lg border border-[var(--border)] p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="vat_registered"
                checked={vatOn}
                disabled={!isOwner}
                onChange={(e) => setVatOn(e.target.checked)}
              />
              ร้านจดทะเบียนภาษีมูลค่าเพิ่ม (ออกใบกำกับภาษีได้)
            </label>
            {vatOn && (
              <div className="mt-3 max-w-[200px]">
                <label className="label">อัตราภาษี (%)</label>
                <input
                  name="vat_rate"
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  defaultValue={org.vat_rate ?? 7}
                  disabled={!isOwner}
                  className="input"
                />
                <p className="mt-1 text-xs text-[var(--muted)]">
                  ราคาสินค้าถือว่ารวม VAT แล้ว — ระบบจะถอด VAT ออกในใบกำกับภาษีให้อัตโนมัติ
                </p>
              </div>
            )}
          </div>

          {isOwner && (
            <button disabled={pending} className="btn-primary">
              บันทึก
            </button>
          )}
        </form>
      </div>

      {/* ทีมงาน */}
      <div className="card p-6">
        <h2 className="font-semibold">ทีมงาน</h2>
        <div className="mt-3 space-y-2">
          {members.map((m) => (
            <div
              key={m.user_id}
              className="flex items-center justify-between text-sm"
            >
              <div>
                <span>{m.email}</span>
                {m.user_id === currentUserId && (
                  <span className="ml-1 text-xs text-[var(--muted)]">(คุณ)</span>
                )}
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                  {m.role === "owner" ? "เจ้าของร้าน" : "พนักงาน"}
                </span>
              </div>
              {isOwner && m.user_id !== currentUserId && (
                <button
                  onClick={() => run(() => removeMember(m.user_id))}
                  className="text-xs text-red-600"
                >
                  นำออก
                </button>
              )}
            </div>
          ))}
        </div>
        {isOwner && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              setMsg(null);
              start(async () => {
                const res = await inviteMember(new FormData(form));
                if (!res.ok)
                  setMsg({ ok: false, text: res.error ?? "ผิดพลาด" });
                else {
                  setMsg({ ok: true, text: res.message ?? "สำเร็จ" });
                  form.reset(); // ล้างเฉพาะตอนเชิญสำเร็จ กันเชิญซ้ำ
                  router.refresh();
                }
              });
            }}
            className="mt-4 flex gap-2"
          >
            <input
              name="email"
              type="email"
              required
              placeholder="อีเมลพนักงาน"
              className="input"
            />
            <button disabled={pending} className="btn-outline whitespace-nowrap">
              เชิญ
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
