"use client";

import { useState, useTransition } from "react";
import { changePassword } from "./actions";

export default function AccountClient() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="card p-6">
      <h2 className="font-semibold">เปลี่ยนรหัสผ่าน</h2>
      {msg && (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}
      <form
        action={(fd) => {
          setMsg(null);
          start(async () => {
            const res = await changePassword(fd);
            if (!res.ok) setMsg({ ok: false, text: res.error ?? "ผิดพลาด" });
            else {
              setMsg({ ok: true, text: res.message ?? "สำเร็จ" });
              (document.getElementById("pw-form") as HTMLFormElement)?.reset();
            }
          });
        }}
        id="pw-form"
        className="mt-4 space-y-3"
      >
        <div>
          <label className="label">รหัสผ่านปัจจุบัน</label>
          <input name="current" type="password" required className="input" />
        </div>
        <div>
          <label className="label">รหัสผ่านใหม่</label>
          <input name="next" type="password" required minLength={6} className="input" />
        </div>
        <div>
          <label className="label">ยืนยันรหัสผ่านใหม่</label>
          <input name="confirm" type="password" required minLength={6} className="input" />
        </div>
        <button disabled={pending} className="btn-primary">
          {pending ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
        </button>
      </form>
    </div>
  );
}
