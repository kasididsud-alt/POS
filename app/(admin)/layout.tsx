import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { signOutAction } from "@/app/(auth)/actions";
import AdminNav from "@/components/admin/AdminNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminPage();

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2 font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--primary)] text-xs text-[var(--primary-fg)]">
              A
            </span>
            <span>ผู้ดูแลระบบ</span>
          </Link>
          <div className="hidden md:block">
            <AdminNav />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden text-sm text-[var(--muted)] hover:text-foreground sm:inline"
            >
              ← กลับแอป
            </Link>
            <span className="hidden text-sm text-[var(--muted)] lg:inline">
              {admin.email}
            </span>
            <form action={signOutAction}>
              <button type="submit" className="btn-outline px-3 py-1.5 text-sm">
                ออกจากระบบ
              </button>
            </form>
          </div>
        </div>
        <div className="border-t border-[var(--border)] px-4 py-2 md:hidden">
          <AdminNav />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
