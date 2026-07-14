import Link from "next/link";
import LogoMark from "@/components/landing/LogoMark";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="lp lp-auth relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
      {/* พื้นหลัง: แสงเขียวนวลด้านบน ตามธีมป้ายร้าน */}
      <div className="lp-bg" aria-hidden="true" />

      <Link
        href="/"
        className="lp-display mb-6 flex items-center gap-2.5 text-xl font-semibold tracking-tight"
      >
        <LogoMark />
        <span>
          ขายดี <span className="text-[var(--green)]">Stock</span>
        </span>
      </Link>

      <div className="w-full max-w-md rounded-3xl border border-[var(--rule)] bg-white p-8 shadow-[0_28px_56px_-30px_rgba(16,35,26,0.4)]">
        {children}
      </div>

      <p className="mt-6 text-center text-xs text-[var(--muted2)]">
        ระบบจัดการสต็อก + ขายหน้าร้านสำหรับร้านค้าไทย
      </p>
    </div>
  );
}
