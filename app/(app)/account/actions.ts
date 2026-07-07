"use server";

import { one, query } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";

type Result = { ok: boolean; error?: string; message?: string };

export async function changePassword(formData: FormData): Promise<Result> {
  try {
    const ctx = await getAppContext();
    if (!ctx) return { ok: false, error: "unauthorized" };

    const current = String(formData.get("current") ?? "");
    const next = String(formData.get("next") ?? "");
    const confirm = String(formData.get("confirm") ?? "");

    if (next.length < 6)
      return { ok: false, error: "รหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร" };
    if (next !== confirm)
      return { ok: false, error: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน" };

    const user = await one<{ password_hash: string }>(
      "select password_hash from users where id=$1",
      [ctx.userId],
    );
    if (!user || !(await verifyPassword(current, user.password_hash)))
      return { ok: false, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };

    const hash = await hashPassword(next);
    await query("update users set password_hash=$1 where id=$2", [hash, ctx.userId]);
    return { ok: true, message: "เปลี่ยนรหัสผ่านเรียบร้อย" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
