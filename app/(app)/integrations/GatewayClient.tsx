"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { saveGatewaySettings, disconnectGateway } from "./actions";

export type GatewaySettings = {
  provider: "omise" | "stripe";
} | null;

const PROVIDER_LABEL = { omise: "Omise (Opn Payments)", stripe: "Stripe" } as const;

/** การ์ด Omise/Stripe — กด "เชื่อมต่อ/ตั้งค่า" เด้ง modal; secret key ไม่ส่งกลับมาโชว์ซ้ำ */
export default function GatewayClient({ settings }: { settings: GatewaySettings }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const connected = settings !== null;
  const showForm = !connected || editing;

  function run(action: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    setMsg(null);
    start(async () => {
      const res = await action();
      if (!res.ok) setMsg({ ok: false, text: res.error ?? "เกิดข้อผิดพลาด" });
      else {
        setMsg({ ok: true, text: okText });
        setEditing(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="card flex items-center gap-4 p-4">
        <div className="text-3xl">💳</div>
        <div className="min-w-0 flex-1">
          <div className="font-medium">Omise / Stripe</div>
          <div className="text-xs text-[var(--muted)]">
            สร้างลิงก์ให้ลูกค้าจ่ายด้วยบัตร/e-wallet — เงินเข้าบัญชี gateway ของร้าน
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {connected ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              เชื่อมต่อแล้ว · {PROVIDER_LABEL[settings.provider]}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              ยังไม่เชื่อมต่อ
            </span>
          )}
          <button
            onClick={() => {
              setMsg(null);
              setEditing(false);
              setOpen(true);
            }}
            className="btn-outline px-3 py-1 text-xs"
          >
            {connected ? "ตั้งค่า" : "เชื่อมต่อ"}
          </button>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={connected ? "ตั้งค่า payment gateway" : "เชื่อมต่อ Omise / Stripe"}
      >
        {msg && (
          <div
            className={`mb-3 rounded-lg px-3 py-2 text-sm ${
              msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}
          >
            {msg.text}
          </div>
        )}

        {connected && !showForm ? (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">ผู้ให้บริการ</span>
              <span className="font-medium">{PROVIDER_LABEL[settings.provider]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">สร้างลิงก์ชำระเงิน</span>
              <a href="/sales-orders" className="text-[var(--primary)] underline">
                จากหน้าออเดอร์ขายส่ง →
              </a>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditing(true)} className="btn-outline px-3 py-1.5 text-sm">
                แก้ไข
              </button>
              <button
                disabled={pending}
                onClick={() => {
                  if (confirm("ยกเลิกการเชื่อมต่อ payment gateway?"))
                    run(disconnectGateway, "ยกเลิกการเชื่อมต่อแล้ว");
                }}
                className="btn-ghost px-3 py-1.5 text-sm text-red-600"
              >
                ยกเลิกการเชื่อมต่อ
              </button>
            </div>
          </div>
        ) : (
          <form
            action={(fd) => run(() => saveGatewaySettings(fd), "เชื่อมต่อสำเร็จ — key ใช้งานได้จริง")}
            className="space-y-3"
          >
            <div>
              <label className="label">ผู้ให้บริการ</label>
              <select
                name="provider"
                className="input"
                defaultValue={settings?.provider ?? "omise"}
              >
                <option value="omise">Omise (Opn Payments) — นิยมในไทย</option>
                <option value="stripe">Stripe</option>
              </select>
            </div>
            <div>
              <label className="label">Secret key</label>
              <input
                name="secret_key"
                required
                placeholder="skey_test_... (Omise) หรือ sk_test_... (Stripe)"
                className="input font-mono text-xs"
                autoComplete="off"
              />
            </div>
            <div className="flex gap-2">
              <button disabled={pending} type="submit" className="btn-primary">
                {pending ? "กำลังตรวจ key..." : "บันทึก + ตรวจ key"}
              </button>
              {editing && (
                <button type="button" onClick={() => setEditing(false)} className="btn-outline">
                  ยกเลิก
                </button>
              )}
            </div>
            <p className="text-xs text-[var(--muted)]">
              ใช้ key จาก dashboard ของผู้ให้บริการ (แนะนำเริ่มจาก test key ก่อน) —
              ระบบตรวจกับ API จริงก่อนบันทึก โดยไม่มีการสร้างรายการเงินใดๆ
            </p>
          </form>
        )}
      </Modal>
    </>
  );
}
