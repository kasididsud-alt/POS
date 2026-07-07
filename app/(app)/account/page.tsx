import { requirePage } from "@/lib/guard";
import AccountClient from "./AccountClient";

const ROLE_LABEL: Record<string, string> = {
  owner: "เจ้าของร้าน",
  cashier: "พนักงาน",
};

export default async function AccountPage() {
  const ctx = await requirePage();

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-bold">บัญชีของฉัน</h1>

      <div className="card p-6">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">อีเมล</span>
            <span>{ctx.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">ร้าน</span>
            <span>{ctx.org.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">บทบาท</span>
            <span>{ROLE_LABEL[ctx.membership?.role ?? ""] ?? "-"}</span>
          </div>
        </div>
      </div>

      <AccountClient />
    </div>
  );
}
