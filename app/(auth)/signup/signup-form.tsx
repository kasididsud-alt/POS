"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { signupAction } from "../actions";
import { scorePassword } from "@/lib/password";

const STRENGTH = [
  { label: "อ่อนมาก", color: "#ef4444" },
  { label: "อ่อน", color: "#f97316" },
  { label: "พอใช้", color: "#eab308" },
  { label: "ดี", color: "#22c55e" },
  { label: "แข็งแรง", color: "#16a34a" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? "กำลังสร้างบัญชี…" : "สร้างบัญชี + เปิดร้าน"}
    </button>
  );
}

export function SignupForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);

  const score = scorePassword(password);
  const mismatch = confirm.length > 0 && confirm !== password;

  return (
    <form action={signupAction} className="mt-6 space-y-4">
      <div>
        <label className="label">ชื่อร้าน</label>
        <input
          name="shop_name"
          type="text"
          required
          placeholder="เช่น ร้านสะดวกซื้อพี่หมี"
          className="input"
        />
      </div>

      <div>
        <label className="label">ชื่อของคุณ</label>
        <input name="full_name" type="text" className="input" />
      </div>

      <div>
        <label className="label">เบอร์โทร (ไม่บังคับ)</label>
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          placeholder="เช่น 0812345678"
          className="input"
        />
      </div>

      <div>
        <label className="label">อีเมล</label>
        <input name="email" type="email" required className="input" />
      </div>

      <div>
        <label className="label">รหัสผ่าน</label>
        <div className="relative">
          <input
            name="password"
            type={show ? "text" : "password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input pr-16"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-[var(--muted)]"
          >
            {show ? "ซ่อน" : "แสดง"}
          </button>
        </div>

        {password.length > 0 && (
          <div className="mt-2">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="h-1 flex-1 rounded-full transition-colors"
                  style={{
                    backgroundColor:
                      i < score ? STRENGTH[score].color : "var(--border)",
                  }}
                />
              ))}
            </div>
            <p className="mt-1 text-xs" style={{ color: STRENGTH[score].color }}>
              ความปลอดภัย: {STRENGTH[score].label}
            </p>
          </div>
        )}
        <p className="mt-1 text-xs text-[var(--muted)]">
          อย่างน้อย 8 ตัว ผสมตัวอักษรและตัวเลข
        </p>
      </div>

      <div>
        <label className="label">ยืนยันรหัสผ่าน</label>
        <input
          name="confirm_password"
          type={show ? "text" : "password"}
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="input"
          aria-invalid={mismatch}
        />
        {mismatch && (
          <p className="mt-1 text-xs text-red-600">รหัสผ่านไม่ตรงกัน</p>
        )}
      </div>

      <label className="flex items-start gap-2 text-sm text-[var(--muted)]">
        <input
          name="tos"
          type="checkbox"
          required
          value="1"
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span>
          ฉันยอมรับ{" "}
          <a href="/terms" target="_blank" className="text-[var(--primary)]">
            ข้อตกลงการใช้งาน
          </a>{" "}
          และ{" "}
          <a href="/privacy" target="_blank" className="text-[var(--primary)]">
            นโยบายความเป็นส่วนตัว
          </a>
        </span>
      </label>

      <SubmitButton />
    </form>
  );
}
