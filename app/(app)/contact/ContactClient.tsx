"use client";

import { useState, useTransition } from "react";
import { sendContactMessage } from "./actions";

const TOPICS = [
  "ปัญหาการใช้งาน",
  "สอบถามแพ็กเกจ/องค์กรใหญ่",
  "ขอเปิดการเชื่อมต่อ (Shopee/Lazada/ขนส่ง ฯลฯ)",
  "ข้อเสนอแนะ",
  "อื่นๆ",
];

export default function ContactClient() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="card p-6">
      <h2 className="font-semibold">ส่งข้อความถึงทีมงาน</h2>
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
        id="contact-form"
        action={(fd) => {
          setMsg(null);
          start(async () => {
            const res = await sendContactMessage(fd);
            if (!res.ok) setMsg({ ok: false, text: res.error ?? "ส่งไม่สำเร็จ" });
            else {
              setMsg({
                ok: true,
                text: "ส่งถึงทีมงานแล้ว — เราจะติดต่อกลับทางอีเมลที่ใช้สมัคร",
              });
              (document.getElementById("contact-form") as HTMLFormElement)?.reset();
            }
          });
        }}
        className="mt-4 space-y-3"
      >
        <div>
          <label className="label">หัวข้อ</label>
          <select name="topic" className="input" defaultValue={TOPICS[0]}>
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">รายละเอียด</label>
          <textarea
            name="message"
            required
            minLength={5}
            maxLength={4000}
            rows={6}
            className="input"
            placeholder="เล่ารายละเอียดให้ฟังหน่อย เช่น ทำอะไรอยู่ เจออะไร อยากให้ช่วยอะไร"
          />
        </div>
        <button disabled={pending} className="btn-primary">
          {pending ? "กำลังส่ง..." : "ส่งข้อความ"}
        </button>
      </form>
    </div>
  );
}
