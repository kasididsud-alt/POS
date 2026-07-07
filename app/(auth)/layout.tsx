import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
      {/* พื้นหลังนุ่ม ๆ ไล่สีอ่อน + แสงวงกลมจาง ๆ */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-indigo-50 via-[var(--background)] to-[var(--background)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-[var(--primary)]/10 blur-3xl"
      />

      <Link
        href="/"
        className="mb-6 flex items-center gap-2 text-xl font-bold tracking-tight"
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] shadow-sm">
          🧾
        </span>
        ขายดี Stock
      </Link>

      <div className="card w-full max-w-md p-8 shadow-lg shadow-slate-200/60">
        {children}
      </div>

      <p className="mt-6 text-center text-xs text-[var(--muted)]">
        ระบบจัดการสต็อก + ขายหน้าร้านสำหรับร้านค้าไทย
      </p>
    </div>
  );
}
