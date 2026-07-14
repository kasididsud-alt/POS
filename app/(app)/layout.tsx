import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAppContext, isSubscriptionActive } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { planForOrg, PLANS, type PlanId } from "@/lib/plans";
import { assertPlanForPath, assertRoleForPath } from "@/lib/limits";
import { countStockAlerts } from "@/lib/queries";
import { signOutAction } from "@/app/(auth)/actions";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import BranchSwitcher from "@/components/BranchSwitcher";

const THAI_DATE = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** ป้ายระดับแพ็กเกจข้างชื่อผู้ใช้ — owner คลิกไป /billing ได้, role อื่นเป็นป้ายเฉยๆ */
function PlanBadge({
  plan,
  trialing,
  canManage,
}: {
  plan: PlanId;
  trialing: boolean;
  canManage: boolean;
}) {
  const tone: Record<PlanId, string> = {
    free: "bg-slate-100 text-slate-700 border-slate-200",
    pro: "bg-emerald-50 text-emerald-700 border-emerald-200",
    premium: "bg-amber-50 text-amber-800 border-amber-300",
  };
  const label = `${PLANS[plan].name}${trialing ? " · ทดลอง" : ""}`;
  const cls = `rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${tone[plan]}`;

  if (!canManage) return <span className={cls}>{label}</span>;
  return (
    <Link href="/billing" title="แพ็กเกจปัจจุบัน — คลิกเพื่อดู/อัปเกรด" className={`${cls} hover:opacity-80`}>
      {label}
    </Link>
  );
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");
  if (!ctx.org) redirect("/onboarding");

  const subActive = isSubscriptionActive(ctx.subscription);
  const trialing = ctx.subscription?.status === "trialing";
  const role = ctx.membership?.role ?? "cashier";
  const plan = planForOrg(ctx.subscription);
  const trialEndsAt = trialing ? (ctx.subscription?.trial_ends_at ?? null) : null;
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000))
    : null;

  // เช็คสิทธิ์ตามแพ็ก + role จุดเดียว — แพ็กต่ำกว่าเด้ง /billing, พนักงานเข้าหน้า owner-only เด้ง /dashboard
  const pathname = (await headers()).get("x-pathname") ?? "";
  assertPlanForPath(ctx.subscription, pathname);
  assertRoleForPath(role, pathname);

  const alertCount = await countStockAlerts(ctx.org.id, ctx.branchId);

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="print:hidden">
        <Sidebar shopName={ctx.org.name} role={role} plan={plan} alertCount={alertCount} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex items-center justify-between border-b border-[var(--border)] bg-white px-4 py-3 print:hidden">
          <div className="text-sm font-medium md:hidden">{ctx.org.name}</div>
          <div className="ml-auto flex items-center gap-3">
            <BranchSwitcher
              branches={ctx.branches}
              currentBranchId={ctx.branchId}
              canSwitch={role === "owner"}
            />
            {isAdminEmail(ctx.email) && (
              <Link
                href="/admin"
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
              >
                ผู้ดูแลระบบ
              </Link>
            )}
            <Link
              href="/account"
              className="hidden text-sm text-[var(--muted)] hover:text-foreground sm:inline"
            >
              {ctx.email}
            </Link>
            <PlanBadge plan={plan} trialing={trialing} canManage={role === "owner"} />
            <form action={signOutAction}>
              <button type="submit" className="btn-outline px-3 py-1.5 text-sm">
                ออกจากระบบ
              </button>
            </form>
          </div>
        </header>

        {/* Subscription banner */}
        {!subActive && (
          <div className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 print:hidden">
            ทดลองใช้งานหมดอายุแล้ว —{" "}
            <Link href="/settings" className="font-semibold underline">
              เลือกแพ็กเกจเพื่อใช้งานต่อ
            </Link>
          </div>
        )}
        {subActive && trialing && (
          <div className="bg-indigo-50 px-4 py-2 text-center text-sm text-indigo-800 print:hidden">
            🎁 กำลังทดลองใช้แพ็ก &ldquo;{PLANS[plan].name}&rdquo; ฟรี
            {trialEndsAt && (
              <>
                {" "}ถึง {THAI_DATE.format(new Date(trialEndsAt))}
                {trialDaysLeft !== null && ` (เหลืออีก ${trialDaysLeft} วัน)`}
              </>
            )}{" "}
            —{" "}
            <Link href="/billing" className="font-semibold underline">
              ดูว่าแพ็กนี้ทำอะไรได้บ้าง
            </Link>
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-4 py-6 pb-20 md:px-8 md:pb-6">{children}</main>
      </div>

      <div className="print:hidden">
        <MobileNav role={role} plan={plan} />
      </div>
    </div>
  );
}
