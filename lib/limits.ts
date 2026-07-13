import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { query, one } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { planForOrg, PLANS } from "@/lib/plans";
import {
  planAllowsPath,
  minPlanForPath,
  roleAllowsPath,
  ROLE_RANK,
  ROLE_LABELS,
  type Role,
} from "@/components/nav";
import type { OrgContext } from "@/lib/guard";
import type { Subscription } from "@/lib/types";

/**
 * guard หน้า/ฟีเจอร์ที่ต้องแพ็กขั้นต่ำ — แพ็กต่ำกว่าเด้งไป /pricing
 * ใช้ใน (app)/layout เพื่อครอบทุกหน้าในจุดเดียว
 */
export function assertPlanForPath(sub: Subscription | null, path: string): void {
  const plan = planForOrg(sub);
  if (!planAllowsPath(plan, path)) {
    const need = minPlanForPath(path);
    redirect(`/billing?upgrade=${encodeURIComponent(need)}`);
  }
}

/** ใช้ในหน้า/action ที่มี ctx อยู่แล้ว */
export function requirePlanForPath(ctx: OrgContext, path: string): void {
  assertPlanForPath(ctx.subscription, path);
}

/**
 * guard หน้าตามบทบาท (cashier < manager < owner) — บทบาทต่ำกว่าขั้นต่ำของ path → เด้ง /dashboard
 * (เมนูซ่อนอยู่แล้วใน navGroupsForRole แต่การซ่อนเมนูกันแค่ตอน render — พิมพ์ URL ตรงยังเข้าได้
 * จึงต้องบังคับที่ layout เหมือน assertPlanForPath)
 */
export function assertRoleForPath(role: string, path: string): void {
  if (!roleAllowsPath(role, path)) {
    redirect("/dashboard");
  }
}

/**
 * เช็คบทบาทขั้นต่ำแบบ "โยน error" (ไม่ redirect) — สำหรับ server action ที่ครอบ try/catch
 * เหตุผลเดียวกับ assertPlanAllows: action เป็น endpoint แยก เรียกตรงได้ ต้อง gate ในตัวเอง
 * (role แปลก ๆ นับเป็นพนักงาน — สิทธิ์ต่ำสุด)
 */
export function assertRoleAtLeast(
  role: string | undefined,
  min: Role,
): void {
  if ((ROLE_RANK[role as Role] ?? 0) < ROLE_RANK[min]) {
    throw new Error(`เฉพาะ${ROLE_LABELS[min]}ขึ้นไปเท่านั้น`);
  }
}

/**
 * เช็คสิทธิ์แพ็กแบบ "โยน error" (ไม่ redirect) — สำหรับ server action ที่ครอบ try/catch
 * แล้วคืน { ok:false, error }. ใช้ redirect() ในนั้นไม่ได้ เพราะ NEXT_REDIRECT จะถูก catch
 * กลืนจน redirect ไม่ทำงาน. gating ที่ layout ทำงานแค่ตอน render หน้า — server action
 * เป็น endpoint แยก เรียกตรงได้ จึงต้อง gate ในตัว action เองด้วย (กันแพ็กต่ำเรียกฟีเจอร์จ่ายเงิน).
 */
export function assertPlanAllows(sub: Subscription | null, path: string): void {
  const plan = planForOrg(sub);
  if (!planAllowsPath(plan, path)) {
    const need = minPlanForPath(path);
    throw new Error(
      `ต้องใช้แพ็ก “${PLANS[need].name}” ขึ้นไปจึงจะใช้ฟีเจอร์นี้ได้ — อัปเกรดที่หน้าแพ็กเกจ`,
    );
  }
}

/**
 * เช็คก่อนเพิ่มสินค้าใหม่ — คืนข้อความ error ถ้าถึงลิมิตแพ็ก (else null)
 * (Infinity = ไม่จำกัด → ไม่ต้องเช็ค)
 */
export async function productLimitError(
  orgId: string,
  sub: Subscription | null,
): Promise<string | null> {
  const plan = planForOrg(sub);
  const max = PLANS[plan].limits.products;
  if (!Number.isFinite(max)) return null;

  // นับเฉพาะสินค้าที่ยัง active — deleteProduct เป็น soft delete (is_active=false)
  // ถ้านับรวมของที่ลบแล้ว โควตาจะเต็มถาวรทั้งที่ผู้ใช้เห็นสินค้าน้อยกว่าลิมิต (list/API กรอง is_active)
  //
  // NOTE (P2-6, ยังไม่แก้ที่นี่): check-then-insert — count ที่นี่กับ insert ในตัว action
  // เป็นคนละ statement ไม่มี lock/serialize → หลาย request พร้อมกันเลี่ยงเพดานได้.
  // การแก้จริงต้องอยู่ที่ path insert (products/actions.ts — นอกขอบเขตงานนี้):
  // ทำ check+insert ใน statement เดียว หรือ pg_advisory_xact_lock(hashtext(org_id)) ครอบ.
  const rows = await query<{ n: number }>(
    "select count(*)::int as n from products where org_id = $1 and is_active = true",
    [orgId],
  );
  const n = Number(rows[0]?.n ?? 0);
  if (n >= max) {
    return `ถึงลิมิตแพ็ก “${PLANS[plan].name}” (${max.toLocaleString("th-TH")} รายการ) แล้ว — อัปเกรดแพ็กเพื่อเพิ่มสินค้าได้อีก`;
  }
  return null;
}

/**
 * เช็คก่อนเพิ่มผู้ใช้เข้าร้าน — คืนข้อความ error ถ้าจำนวนสมาชิกถึงลิมิตแพ็ก (else null)
 * Free 1 / Pro 5 / Premium ไม่จำกัด
 */
export async function userLimitError(
  orgId: string,
  sub: Subscription | null,
): Promise<string | null> {
  const plan = planForOrg(sub);
  const max = PLANS[plan].limits.users;
  if (!Number.isFinite(max)) return null;

  const rows = await query<{ n: number }>(
    "select count(*)::int as n from memberships where org_id = $1",
    [orgId],
  );
  const n = Number(rows[0]?.n ?? 0);
  if (n >= max) {
    return `แพ็ก “${PLANS[plan].name}” ใช้ได้ ${max.toLocaleString("th-TH")} ผู้ใช้ (ตอนนี้มี ${n}) — อัปเกรดแพ็กเพื่อเพิ่มพนักงาน`;
  }
  return null;
}

export type InviteResult = {
  ok: boolean;
  error?: string;
  message?: string;
};

/**
 * เพิ่มผู้ใช้เข้าร้าน (ฟังก์ชันกลาง — ใช้ทั้งหน้า staff และ settings)
 * บังคับ user limit ตามแพ็ก, หา user เดิมหรือสร้างใหม่พร้อมรหัสผ่านชั่วคราว,
 * กันเพิ่มซ้ำ, สังกัดสาขาหลักไว้ก่อน
 */
export async function inviteUserToOrg(
  ctx: OrgContext,
  emailRaw: string,
  role: Role,
): Promise<InviteResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false, error: "อีเมลไม่ถูกต้อง" };

  const limitMsg = await userLimitError(ctx.org.id, ctx.subscription);
  if (limitMsg) return { ok: false, error: limitMsg };

  let user = await one<{ id: string }>("select id from users where email=$1", [
    email,
  ]);
  let tempPassword: string | null = null;
  if (!user) {
    tempPassword = randomBytes(6).toString("base64url");
    const hash = await hashPassword(tempPassword);
    user = await one<{ id: string }>(
      "insert into users (email, password_hash) values ($1,$2) returning id",
      [email, hash],
    );
  }

  const exists = await one(
    "select id from memberships where org_id=$1 and user_id=$2",
    [ctx.org.id, user!.id],
  );
  if (exists) return { ok: false, error: "พนักงานคนนี้อยู่ในร้านแล้ว" };

  // สังกัดสาขาหลักไว้ก่อน (เจ้าของเปลี่ยนได้ทีหลัง)
  const defaultBranch =
    ctx.branches.find((b) => b.is_default) ?? ctx.branches[0] ?? null;
  await query(
    "insert into memberships (org_id, user_id, role, branch_id) values ($1,$2,$3,$4)",
    [ctx.org.id, user!.id, role, defaultBranch?.id ?? null],
  );

  return {
    ok: true,
    message: tempPassword
      ? `เพิ่ม ${email} แล้ว — รหัสผ่านชั่วคราว: ${tempPassword} (ให้พนักงานเปลี่ยนภายหลัง)`
      : `เพิ่ม ${email} เข้าร้านแล้ว`,
  };
}
