import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";
import { GoogleButton } from "@/components/google-button";
import { googleConfigured } from "@/lib/oauth";

export const metadata: Metadata = {
  title: "สมัครใช้งานฟรี",
  description:
    "เปิดร้านกับ ขายดี Stock ฟรี — โปรแกรม POS + ระบบจัดการสต็อก ตัดสต็อกอัตโนมัติ รับพร้อมเพย์ ทดลองฟีเจอร์เต็ม 14 วัน ไม่ต้องใช้บัตรเครดิต",
  alternates: { canonical: "/signup" },
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const showGoogle = googleConfigured();

  return (
    <div>
      <h1 className="text-2xl font-bold">สมัครใช้งาน</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        ทดลองฟรี 14 วัน ไม่ต้องใช้บัตรเครดิต
      </p>

      {sp.error && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {sp.error}
        </div>
      )}

      {showGoogle && (
        <>
          <div className="mt-6">
            <GoogleButton next="/onboarding" label="สมัครด้วย Google" />
          </div>
          <div className="my-6 flex items-center gap-3 text-xs text-[var(--muted)]">
            <span className="h-px flex-1 bg-[var(--border)]" />
            หรือกรอกข้อมูล
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>
        </>
      )}

      <SignupForm />

      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        มีบัญชีอยู่แล้ว?{" "}
        <Link href="/login" className="font-medium text-[var(--primary)]">
          เข้าสู่ระบบ
        </Link>
      </p>
    </div>
  );
}
