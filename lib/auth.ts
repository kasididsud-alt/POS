import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/session";
import { one, query } from "@/lib/db";
import type { Branch, Membership, Organization, Subscription } from "@/lib/types";

/** cookie ที่เจ้าของใช้สลับสาขาที่กำลังดู */
export const ACTIVE_BRANCH_COOKIE = "active_branch";

export type AppContext = {
  userId: string;
  email: string | null;
  org: Organization | null;
  membership: Membership | null;
  subscription: Subscription | null;
  /** สาขาที่รายการปัจจุบันทำงานอยู่ (staff = สาขาตัวเอง, owner = สาขาที่เลือก) */
  branchId: string | null;
  /** สาขาทั้งหมดของ org (default มาก่อน) — ใช้ทำ switcher */
  branches: Branch[];
};

/** context ของผู้ใช้ปัจจุบัน: org แรกที่สังกัด + role + subscription + สาขาปัจจุบัน */
export async function getAppContext(): Promise<AppContext | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const membership = await one<Membership>(
    "select * from memberships where user_id = $1 order by created_at asc limit 1",
    [user.id],
  );

  let org: Organization | null = null;
  let subscription: Subscription | null = null;
  let branches: Branch[] = [];
  let branchId: string | null = null;

  if (membership) {
    org = await one<Organization>(
      "select * from organizations where id = $1",
      [membership.org_id],
    );
    subscription = await one<Subscription>(
      "select * from subscriptions where org_id = $1",
      [membership.org_id],
    );
    branches = await query<Branch>(
      "select * from branches where org_id = $1 order by is_default desc, created_at asc",
      [membership.org_id],
    );

    const defaultBranch =
      branches.find((b) => b.is_default) ?? branches[0] ?? null;

    // owner สลับสาขาได้ผ่าน cookie (ต้อง validate ว่าเป็นสาขาของ org นี้จริง)
    if (membership.role === "owner") {
      const cookieVal = (await cookies()).get(ACTIVE_BRANCH_COOKIE)?.value;
      const picked = cookieVal && branches.find((b) => b.id === cookieVal);
      branchId = picked
        ? picked.id
        : (membership.branch_id ?? defaultBranch?.id ?? null);
    } else {
      branchId = membership.branch_id ?? defaultBranch?.id ?? null;
    }
  }

  return {
    userId: user.id,
    email: user.email,
    org,
    membership,
    subscription,
    branchId,
    branches,
  };
}

/** subscription ใช้งานได้ไหม (active/trialing และยังไม่หมดอายุ) */
export function isSubscriptionActive(sub: Subscription | null): boolean {
  if (!sub) return false;
  // ผู้ดูแลระบบ comp แพ็กเกจจ่ายเงินให้ = ถือว่าใช้งานได้ (comp 'free' ไม่ปลดล็อก)
  if (sub.comp_plan && sub.comp_plan !== "free") return true;
  const now = Date.now();
  if (sub.status === "active") return true;
  if (sub.status === "trialing") {
    if (!sub.trial_ends_at) return true;
    return new Date(sub.trial_ends_at).getTime() > now;
  }
  return false;
}
