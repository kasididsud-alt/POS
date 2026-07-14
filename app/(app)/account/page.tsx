import Link from "next/link";
import { requirePage } from "@/lib/guard";
import { isSubscriptionActive } from "@/lib/auth";
import { planForOrg, PLANS } from "@/lib/plans";
import AccountClient from "./AccountClient";

const ROLE_LABEL: Record<string, string> = {
  owner: "เจ้าของร้าน",
  manager: "ผู้จัดการ",
  cashier: "พนักงาน",
};

const THAI_DATE = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function AccountPage() {
  const ctx = await requirePage();

  const sub = ctx.subscription;
  const plan = planForOrg(sub);
  const subActive = isSubscriptionActive(sub);
  const trialing = sub?.status === "trialing";
  const isOwner = ctx.membership?.role === "owner";

  // วันหมดอายุ: ช่วงทดลองใช้ trial_ends_at, จ่ายจริงใช้ current_period_end
  const endsAt = trialing
    ? sub?.trial_ends_at
    : (sub?.current_period_end ?? null);
  const daysLeft = endsAt
    ? Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86_400_000))
    : null;

  const statusLabel = !subActive
    ? { text: "หมดอายุแล้ว", cls: "bg-red-50 text-red-700" }
    : trialing
      ? { text: "ทดลองใช้ฟรี", cls: "bg-indigo-50 text-indigo-700" }
      : { text: "ใช้งานอยู่", cls: "bg-green-50 text-green-700" };

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

      <div className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">แพ็กเกจ & สิทธิ์การใช้งาน</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusLabel.cls}`}>
            {statusLabel.text}
          </span>
        </div>
        <div className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">แพ็กเกจปัจจุบัน</span>
            <span className="font-medium">{PLANS[plan].name}</span>
          </div>
          {endsAt && (
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">
                {trialing ? "ทดลองใช้ถึง" : "รอบบิลปัจจุบันถึง"}
              </span>
              <span>{THAI_DATE.format(new Date(endsAt))}</span>
            </div>
          )}
          {daysLeft !== null && subActive && (
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">คงเหลือ</span>
              <span className={daysLeft <= 3 ? "font-medium text-red-600" : ""}>
                อีก {daysLeft} วัน
              </span>
            </div>
          )}
        </div>
        {isOwner && (
          <Link href="/billing" className="btn-outline mt-4 inline-block px-3 py-1.5 text-sm">
            ดู/เปลี่ยนแพ็กเกจ →
          </Link>
        )}
      </div>

      <AccountClient />
    </div>
  );
}
