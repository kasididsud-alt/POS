"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { saveSmsSettings, disconnectSms } from "./actions";

export type SmsSettings = {
  provider: "thaibulksms" | "twilio";
  sender: string | null;
} | null;

const PROVIDER_LABEL = { thaibulksms: "ThaiBulkSMS", twilio: "Twilio" } as const;

/** การ์ด SMS — กด "เชื่อมต่อ/ตั้งค่า" เด้ง modal; secret ไม่ส่งกลับมาโชว์ซ้ำ */
export default function SmsClient({ settings }: { settings: SmsSettings }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [provider, setProvider] = useState<"thaibulksms" | "twilio">(
    settings?.provider ?? "thaibulksms",
  );
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
        <div className="text-3xl">✉️</div>
        <div className="min-w-0 flex-1">
          <div className="font-medium">SMS</div>
          <div className="text-xs text-[var(--muted)]">
            ส่ง SMS แจ้งสถานะออเดอร์ถึงเบอร์ลูกค้า (ค่าส่งตามแพ็กเกจผู้ให้บริการ)
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
        title={connected ? "ตั้งค่า SMS" : "เชื่อมต่อ SMS"}
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
              <span className="text-[var(--muted)]">ชื่อผู้ส่ง / เบอร์ From</span>
              <span className="font-mono text-xs">{settings.sender ?? "ค่าเริ่มต้นของผู้ให้บริการ"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">แจ้งสถานะออเดอร์</span>
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
                  if (confirm("ยกเลิกการเชื่อมต่อ SMS?"))
                    run(disconnectSms, "ยกเลิกการเชื่อมต่อแล้ว");
                }}
                className="btn-ghost px-3 py-1.5 text-sm text-red-600"
              >
                ยกเลิกการเชื่อมต่อ
              </button>
            </div>
          </div>
        ) : (
          <form
            action={(fd) =>
              run(() => saveSmsSettings(fd), "เชื่อมต่อสำเร็จ — credentials ใช้งานได้จริง")
            }
            className="space-y-3"
          >
            <div>
              <label className="label">ผู้ให้บริการ</label>
              <select
                name="provider"
                className="input"
                value={provider}
                onChange={(e) => setProvider(e.target.value as "thaibulksms" | "twilio")}
              >
                <option value="thaibulksms">ThaiBulkSMS — นิยมในไทย</option>
                <option value="twilio">Twilio</option>
              </select>
            </div>
            <div>
              <label className="label">
                {provider === "twilio" ? "Account SID" : "API key"}
              </label>
              <input name="api_key" required className="input font-mono text-xs" autoComplete="off" />
            </div>
            <div>
              <label className="label">
                {provider === "twilio" ? "Auth Token" : "API secret"}
              </label>
              <input
                name="api_secret"
                type="password"
                required
                className="input font-mono text-xs"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label">
                {provider === "twilio"
                  ? "เบอร์ From (เช่น +1415xxxxxxx) *"
                  : "ชื่อผู้ส่ง (sender ที่ลงทะเบียนไว้ — เว้นว่าง = ค่าเริ่มต้น)"}
              </label>
              <input
                name="sender"
                defaultValue={settings?.sender ?? ""}
                className="input font-mono text-xs"
                autoComplete="off"
              />
            </div>
            <div className="flex gap-2">
              <button disabled={pending} type="submit" className="btn-primary">
                {pending ? "กำลังตรวจ..." : "บันทึก + ตรวจ credentials"}
              </button>
              {editing && (
                <button type="button" onClick={() => setEditing(false)} className="btn-outline">
                  ยกเลิก
                </button>
              )}
            </div>
            <p className="text-xs text-[var(--muted)]">
              ระบบตรวจกับ API จริงก่อนบันทึก (เช็คข้อมูลบัญชี ไม่ส่งข้อความ ไม่เสียเครดิต) —
              ค่าส่งต่อข้อความคิดตามแพ็กเกจที่ร้านมีกับผู้ให้บริการ
            </p>
          </form>
        )}
      </Modal>
    </>
  );
}
