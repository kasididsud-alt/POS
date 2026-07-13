"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { assertPlanAllows, inviteUserToOrg } from "@/lib/limits";
import type { OrgContext } from "@/lib/guard";

type Result = { ok: boolean; error?: string; message?: string };

async function requireOwner() {
  const ctx = await getAppContext();
  if (!ctx?.org) throw new Error("unauthorized");
  if (ctx.membership?.role !== "owner")
    throw new Error("เฉพาะเจ้าของร้านเท่านั้น");
  return ctx;
}

export async function inviteStaff(formData: FormData): Promise<Result> {
  try {
    const ctx = await requireOwner();
    // พนักงาน & สิทธิ์ = ฟีเจอร์แพ็ก Pro — บังคับที่ action ด้วย (layout gate ทำงานแค่ตอน render)
    // gate เฉพาะการเพิ่มคน — เปลี่ยนบทบาท/ย้ายสาขา/ลบคนเดิมต้องทำได้หลังดาวน์เกรด
    assertPlanAllows(ctx.subscription, "/staff");
    const email = String(formData.get("email") ?? "");
    const role = String(formData.get("role") ?? "cashier");
    if (!["owner", "manager", "cashier"].includes(role))
      return { ok: false, error: "บทบาทไม่ถูกต้อง" };

    const result = await inviteUserToOrg(
      ctx as OrgContext,
      email,
      role as "owner" | "manager" | "cashier",
    );
    if (result.ok) revalidatePath("/staff");
    return result;
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function changeRole(
  userId: string,
  role: string,
): Promise<Result> {
  try {
    const ctx = await requireOwner();
    if (!["owner", "manager", "cashier"].includes(role))
      return { ok: false, error: "บทบาทไม่ถูกต้อง" };
    if (userId === ctx.userId)
      return { ok: false, error: "เปลี่ยนบทบาทตัวเองไม่ได้" };

    await query("update memberships set role=$1 where org_id=$2 and user_id=$3", [
      role,
      ctx.org!.id,
      userId,
    ]);
    revalidatePath("/staff");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function setStaffBranch(
  userId: string,
  branchId: string,
): Promise<Result> {
  try {
    const ctx = await requireOwner();
    if (!ctx.branches.some((b) => b.id === branchId))
      return { ok: false, error: "ไม่พบสาขานี้" };
    await query(
      "update memberships set branch_id=$1 where org_id=$2 and user_id=$3",
      [branchId, ctx.org!.id, userId],
    );
    revalidatePath("/staff");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function removeStaff(userId: string): Promise<Result> {
  try {
    const ctx = await requireOwner();
    if (userId === ctx.userId) return { ok: false, error: "ลบตัวเองไม่ได้" };
    await query("delete from memberships where org_id=$1 and user_id=$2", [
      ctx.org!.id,
      userId,
    ]);
    revalidatePath("/staff");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
