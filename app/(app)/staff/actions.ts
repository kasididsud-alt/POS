"use server";

import { revalidatePath } from "next/cache";
import { query, one } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { getAppContext } from "@/lib/auth";

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
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const role = String(formData.get("role") ?? "cashier");
    if (!email) return { ok: false, error: "กรุณากรอกอีเมล" };
    if (!["owner", "cashier"].includes(role))
      return { ok: false, error: "บทบาทไม่ถูกต้อง" };

    let user = await one<{ id: string }>("select id from users where email=$1", [
      email,
    ]);
    let tempPassword: string | null = null;
    if (!user) {
      tempPassword = Math.random().toString(36).slice(-8);
      const hash = await hashPassword(tempPassword);
      user = await one<{ id: string }>(
        "insert into users (email, password_hash) values ($1,$2) returning id",
        [email, hash],
      );
    }

    const exists = await one(
      "select id from memberships where org_id=$1 and user_id=$2",
      [ctx.org!.id, user!.id],
    );
    if (exists) return { ok: false, error: "พนักงานคนนี้อยู่ในร้านแล้ว" };

    // สังกัดสาขาหลักไว้ก่อน (เจ้าของเปลี่ยนได้ทีหลัง)
    const defaultBranch =
      ctx.branches.find((b) => b.is_default) ?? ctx.branches[0] ?? null;
    await query(
      "insert into memberships (org_id, user_id, role, branch_id) values ($1,$2,$3,$4)",
      [ctx.org!.id, user!.id, role, defaultBranch?.id ?? null],
    );

    revalidatePath("/staff");
    return {
      ok: true,
      message: tempPassword
        ? `เพิ่ม ${email} แล้ว — รหัสผ่านชั่วคราว: ${tempPassword}`
        : `เพิ่ม ${email} เข้าร้านแล้ว`,
    };
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
    if (!["owner", "cashier"].includes(role))
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
