import type { Metadata } from "next";
import Link from "next/link";
import { loginAction } from "../actions";
import { GoogleButton } from "@/components/google-button";
import { googleConfigured } from "@/lib/oauth";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ",
  description:
    "เข้าสู่ระบบ ขายดี Stock — โปรแกรมขายหน้าร้าน (POS) + ระบบจัดการสต็อกสำหรับร้านค้าไทย จัดการร้านได้ทุกที่บนมือถือ",
  alternates: { canonical: "/login" },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const next = sp.next ?? "/dashboard";
  const showGoogle = googleConfigured();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">เข้าสู่ระบบ</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">ยินดีต้อนรับกลับมา 👋</p>

      {sp.error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <WarnIcon />
          <span>{sp.error}</span>
        </div>
      )}
      {sp.message && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          <CheckIcon />
          <span>{sp.message}</span>
        </div>
      )}

      {showGoogle && (
        <>
          <div className="mt-6">
            <GoogleButton next={next} label="เข้าสู่ระบบด้วย Google" />
          </div>
          <div className="my-6 flex items-center gap-3 text-xs text-[var(--muted)]">
            <span className="h-px flex-1 bg-[var(--border)]" />
            หรือใช้อีเมล
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>
        </>
      )}

      <form
        action={loginAction}
        className={showGoogle ? "space-y-4" : "mt-6 space-y-4"}
      >
        <input type="hidden" name="next" value={next} />
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
        <div>
          <div className="flex items-center justify-between">
            <label className="label">รหัสผ่าน</label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-[var(--primary)] hover:underline"
            >
              ลืมรหัสผ่าน?
            </Link>
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
              <LockIcon />
            </span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="input pl-10"
            />
          </div>
        </div>
        <button type="submit" className="btn-primary w-full">
          เข้าสู่ระบบ
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        ยังไม่มีบัญชี?{" "}
        <Link href="/signup" className="font-medium text-[var(--primary)] hover:underline">
          สมัครใช้งานฟรี
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

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="m8 12 2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
