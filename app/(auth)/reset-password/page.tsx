import Link from "next/link";
import { one } from "@/lib/db";
import { hashToken } from "@/lib/reset-token";
import { resetPasswordAction } from "../actions";

/** ปิดบังอีเมลบางส่วน เช่น somchai@gmail.com → so••••i@gmail.com */
function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  if (name.length <= 2) return `${name[0]}••@${domain}`;
  return `${name.slice(0, 2)}••••${name.slice(-1)}@${domain}`;
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string; invalid?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token ?? "";

  // เช็ค token ฝั่ง server ก่อนแสดงผล + ดึงอีเมลของผู้ใช้คนนั้นมา
  let email: string | null = null;
  if (token && !sp.invalid) {
    const row = await one<{ email: string }>(
      `select u.email
         from password_reset_tokens t
         join users u on u.id = t.user_id
        where t.token_hash = $1 and t.used_at is null and t.expires_at > now()`,
      [hashToken(token)],
    );
    email = row?.email ?? null;
  }

  // token พัง/หมดอายุ/ถูกใช้แล้ว → ไม่แสดงฟอร์ม
  if (!email) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ลิงก์ใช้ไม่ได้</h1>
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <WarnIcon />
          <span>
            ลิงก์รีเซ็ตรหัสผ่านนี้หมดอายุ ถูกใช้ไปแล้ว หรือไม่ถูกต้อง
            กรุณาขอลิงก์ใหม่อีกครั้ง
          </span>
        </div>
        <Link href="/forgot-password" className="btn-primary mt-6 flex w-full items-center justify-center">
          ขอลิงก์รีเซ็ตใหม่
        </Link>
        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          <Link href="/login" className="font-medium text-[var(--primary)] hover:underline">
            ← กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">ตั้งรหัสผ่านใหม่</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        สำหรับบัญชี <span className="font-medium text-[var(--foreground)]">{maskEmail(email)}</span>
      </p>

      {sp.error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <WarnIcon />
          <span>{sp.error}</span>
        </div>
      )}

      <form action={resetPasswordAction} className="mt-6 space-y-4">
        <input type="hidden" name="token" value={token} />
        <div>
          <label className="label">รหัสผ่านใหม่</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
              <LockIcon />
            </span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="อย่างน้อย 8 ตัวอักษร"
              className="input pl-10"
            />
          </div>
        </div>
        <div>
          <label className="label">ยืนยันรหัสผ่านใหม่</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
              <LockIcon />
            </span>
            <input
              name="confirm_password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
              className="input pl-10"
            />
          </div>
        </div>
        <button type="submit" className="btn-primary w-full">
          บันทึกรหัสผ่านใหม่
        </button>
      </form>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7v6M12 16.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
