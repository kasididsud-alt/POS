import Link from "next/link";
import { requestPasswordResetAction } from "../actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    sent?: string;
    google?: string;
  }>;
}) {
  const sp = await searchParams;

  // เคสบัญชี Google ล้วน — ไม่มีรหัสผ่านให้รีเซ็ต
  if (sp.google) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight">บัญชีนี้ใช้ Google</h1>
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
          <InfoIcon />
          <span>
            อีเมลนี้สมัครไว้ด้วย Google จึงไม่มีรหัสผ่านให้รีเซ็ต
            กรุณาเข้าสู่ระบบด้วยปุ่ม Google
          </span>
        </div>
        <a href="/api/auth/google?next=/dashboard" className="btn-outline mt-6 flex w-full items-center justify-center gap-2">
          <GoogleIcon />
          เข้าสู่ระบบด้วย Google
        </a>
        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          <Link href="/login" className="font-medium text-[var(--primary)] hover:underline">
            ← กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </p>
      </div>
    );
  }

  // ส่งคำขอแล้ว — ตอบกลางๆ (ไม่เปิดเผยว่ามีอีเมลนี้ในระบบหรือไม่)
  if (sp.sent) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ตรวจสอบอีเมลของคุณ</h1>
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          <CheckIcon />
          <span>
            ถ้ามีบัญชีที่ใช้อีเมลนี้ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปแล้ว
            กรุณาตรวจสอบกล่องจดหมาย (และโฟลเดอร์สแปม) — ลิงก์หมดอายุใน 30 นาที
          </span>
        </div>
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
      <h1 className="text-2xl font-bold tracking-tight">ลืมรหัสผ่าน?</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้
      </p>

      {sp.error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <WarnIcon />
          <span>{sp.error}</span>
        </div>
      )}

      <form action={requestPasswordResetAction} className="mt-6 space-y-4">
        <div>
          <label className="label">อีเมล</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
              <MailIcon />
            </span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="input pl-10"
            />
          </div>
        </div>
        <button type="submit" className="btn-primary w-full">
          ส่งลิงก์รีเซ็ตรหัสผ่าน
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        นึกรหัสผ่านออกแล้ว?{" "}
        <Link href="/login" className="font-medium text-[var(--primary)] hover:underline">
          เข้าสู่ระบบ
        </Link>
      </p>
    </div>
  );
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="m4 7 8 5 8-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="m8 12 2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 11v5M12 7.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.46 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
