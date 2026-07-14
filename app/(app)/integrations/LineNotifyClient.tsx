"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { saveLineSettings, disconnectLine } from "./actions";

export type LineSettings = {
  recipient_id: string;
  notify_low_stock: boolean;
} | null;

/**
 * การ์ด LINE OA สไตล์เดียวกับ integration ตัวอื่น — กด "เชื่อมต่อ/ตั้งค่า" แล้วเด้ง modal
 * token แสดงเฉพาะตอนกรอก ไม่ส่งกลับมาโชว์ซ้ำ
 */
export default function LineNotifyClient({ settings }: { settings: LineSettings }) {
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
      {/* การ์ดในกริด — หน้าตาเดียวกับ integration ตัวอื่น แต่กดได้จริง */}
      <div className="card flex items-center gap-4 p-4">
        <div className="text-3xl">💬</div>
        <div className="min-w-0 flex-1">
          <div className="font-medium">LINE Official Account</div>
          <div className="text-xs text-[var(--muted)]">
            แจ้งของใกล้หมดเข้า LINE คุณ + ส่งโปรโมชั่นหาลูกค้า
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {connected ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              เชื่อมต่อแล้ว
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
        title={connected ? "ตั้งค่า LINE Official Account" : "เชื่อมต่อ LINE Official Account"}
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
              <span className="text-[var(--muted)]">ส่งไปที่</span>
              <span className="font-mono text-xs">{settings.recipient_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">แจ้งสินค้าใกล้หมด</span>
              <span>{settings.notify_low_stock ? "เปิด" : "ปิด"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">ส่งโปรโมชั่นหาลูกค้า</span>
              <a href="/promotions" className="text-[var(--primary)] underline">
                ไปที่หน้าโปรโมชั่น →
              </a>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditing(true)} className="btn-outline px-3 py-1.5 text-sm">
                แก้ไข
              </button>
              <button
                disabled={pending}
                onClick={() => {
                  if (confirm("ยกเลิกการเชื่อมต่อ LINE?"))
                    run(disconnectLine, "ยกเลิกการเชื่อมต่อแล้ว");
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
              run(
                () => saveLineSettings(fd),
                "เชื่อมต่อสำเร็จ — ส่งข้อความทดสอบเข้า LINE แล้ว ลองเช็คดูได้เลย",
              )
            }
            className="space-y-3"
          >
            <div>
              <label className="label">Channel access token (จาก LINE Developers Console)</label>
              <input
                name="channel_token"
                required
                placeholder="วาง long-lived channel access token ของ LINE OA"
                className="input font-mono text-xs"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label">User ID / Group ID ปลายทาง</label>
              <input
                name="recipient_id"
                required
                defaultValue={settings?.recipient_id ?? ""}
                placeholder="เช่น Uxxxxxxxx... (userId) หรือ Cxxxxxxxx... (groupId)"
                className="input font-mono text-xs"
                autoComplete="off"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="notify_low_stock"
                defaultChecked={settings?.notify_low_stock ?? true}
              />
              แจ้งเตือนเมื่อสินค้าใกล้หมด (เช็คหลังการขายทุกบิล เตือนซ้ำตัวเดิมไม่เกินวันละครั้ง)
            </label>
            <div className="flex gap-2">
              <button disabled={pending} type="submit" className="btn-primary">
                {pending ? "กำลังทดสอบส่ง..." : "บันทึก + ส่งข้อความทดสอบ"}
              </button>
              {editing && (
                <button type="button" onClick={() => setEditing(false)} className="btn-outline">
                  ยกเลิก
                </button>
              )}
            </div>
            <p className="text-xs text-[var(--muted)]">
              วิธีหา: สร้าง Messaging API channel ใน LINE Developers Console → ออก channel access
              token → เพิ่มบอทเข้ากลุ่ม LINE ของร้าน (หรือแอดเป็นเพื่อน) แล้วดู userId/groupId จาก
              webhook event หรือเครื่องมือของ LINE
            </p>
          </form>
        )}
      </Modal>
    </>
  );
}
