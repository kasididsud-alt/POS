"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getAppContext, ACTIVE_BRANCH_COOKIE } from "@/lib/auth";

/** เจ้าของสลับสาขาที่กำลังดู — เก็บใน cookie (validate ว่าเป็นสาขาของ org จริง) */
export async function setActiveBranch(branchId: string): Promise<void> {
  const ctx = await getAppContext();
  if (!ctx?.org || ctx.membership?.role !== "owner") return;
  if (!ctx.branches.some((b) => b.id === branchId)) return;

  (await cookies()).set(ACTIVE_BRANCH_COOKIE, branchId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
