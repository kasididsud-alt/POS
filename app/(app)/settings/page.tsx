import Link from "next/link";
import { requireOwnerPage } from "@/lib/guard";
import { query } from "@/lib/db";
import { isSubscriptionActive } from "@/lib/auth";
import { isStripeConfigured } from "@/lib/stripe";
import { planForOrg, PLANS } from "@/lib/plans";
import { formatDate } from "@/lib/format";
import SettingsClient from "./SettingsClient";

const STATUS_LABEL: Record<string, string> = {
  trialing: "ทดลองใช้",
  active: "ใช้งานอยู่",
  past_due: "ค้างชำระ",
  canceled: "ยกเลิกแล้ว",
  incomplete: "ยังไม่สมบูรณ์",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string; error?: string }>;
}) {
  const ctx = await requireOwnerPage();
  const sp = await searchParams;

  const members = await query<{ user_id: string; role: string; email: string }>(
    `select m.user_id, m.role, u.email
       from memberships m join users u on u.id = m.user_id
      where m.org_id = $1
      order by m.created_at`,
    [ctx.org.id],
  );

  const isOwner = ctx.membership?.role === "owner";
  const sub = ctx.subscription;
  const subActive = isSubscriptionActive(sub);
  const currentPlan = PLANS[planForOrg(sub)];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">ตั้งค่า</h1>

      {sp.success && (
        <div className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          ✅ สมัครแพ็กเกจสำเร็จ ขอบคุณครับ
        </div>
      )}
      {sp.error && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {sp.error}
        </div>
      )}

      <div className="mt-6 space-y-6">
        <SettingsClient
          org={ctx.org}
          members={members}
          isOwner={isOwner}
          currentUserId={ctx.userId}
        />

        {/* แพ็กเกจ / Billing */}
        <div className="card p-6">
          <h2 className="font-semibold">แพ็กเกจการใช้งาน</h2>
          <div className="mt-2 text-sm">
            แพ็กปัจจุบัน:{" "}
            <span className="font-medium">{currentPlan.name}</span>
            {" · "}
          </div>
          <div className="mt-1 text-sm">
            สถานะ:{" "}
            <span
              className={`font-medium ${subActive ? "text-green-600" : "text-red-600"}`}
            >
              {STATUS_LABEL[sub?.status ?? ""] ?? "ไม่มีแพ็กเกจ"}
            </span>
            {sub?.status === "trialing" && sub.trial_ends_at && (
              <span className="text-[var(--muted)]">
                {" "}
                · ทดลองถึง {formatDate(sub.trial_ends_at)}
              </span>
            )}
            {sub?.current_period_end && sub.status === "active" && (
              <span className="text-[var(--muted)]">
                {" "}
                · รอบถัดไป {formatDate(sub.current_period_end)}
              </span>
            )}
          </div>

          {!isStripeConfigured && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              โหมด local — ยังไม่ได้เปิด Stripe (ใช้ทดลองฟรีได้เลย)
              ตอนขึ้น prod ค่อยใส่ STRIPE_SECRET_KEY + Price ID เพื่อเปิดการชำระเงิน
            </p>
          )}

          {isOwner && (
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/billing" className="btn-primary">
                ดูแพ็กเกจ / เปลี่ยนแพ็ก
              </Link>
              {isStripeConfigured && sub?.stripe_subscription_id && (
                <form action="/api/stripe/portal" method="POST">
                  <button className="btn-outline">จัดการการชำระเงิน / ใบเสร็จ</button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
