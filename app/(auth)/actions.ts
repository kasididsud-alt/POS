"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { query, one } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  scorePassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_SCORE,
} from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { newResetToken, hashToken } from "@/lib/reset-token";
import { sendPasswordResetEmail } from "@/lib/mailer";

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

// ลืมรหัสผ่าน: token 30 นาที, ขอได้ไม่เกิน 3 ครั้ง/15 นาที ต่ออีเมล
const RESET_TOKEN_MINUTES = 30;
const RESET_MAX_PER_WINDOW = 3;
const RESET_WINDOW_MINUTES = 15;

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

// กันสมัครรัวจาก IP เดียว
const MAX_SIGNUPS_PER_IP = 10;

const signupError = (msg: string): never =>
  redirect("/signup?error=" + encodeURIComponent(msg));

/** ดึง IP ผู้เรียกจาก reverse proxy header (fallback 'unknown') */
async function clientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return h.get("x-real-ip")?.trim() || "unknown";
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  // เช็คว่าโดนล็อกจากการพยายามล็อกอินผิดรัวไหม
  const attempt = await one<{ fails: number; locked_until: string | null }>(
    "select fails, locked_until from login_attempts where email=$1",
    [email],
  );
  if (attempt?.locked_until && new Date(attempt.locked_until).getTime() > Date.now()) {
    redirect(
      "/login?error=" +
        encodeURIComponent(
          `พยายามเข้าสู่ระบบผิดหลายครั้ง — ลองใหม่ในอีก ${LOCK_MINUTES} นาที`,
        ),
    );
  }

  const user = await one<{ id: string; password_hash: string | null }>(
    "select id, password_hash from users where email = $1",
    [email],
  );

  // บัญชี Google ล้วน (password_hash null) ให้ตอบเหมือนรหัสผิด — กัน account enumeration
  if (
    !user ||
    !user.password_hash ||
    !(await verifyPassword(password, user.password_hash))
  ) {
    // นับครั้งล้มเหลว + ล็อกเมื่อถึงเกณฑ์
    await query(
      `insert into login_attempts (email, fails, updated_at)
       values ($1, 1, now())
       on conflict (email) do update set
         fails = login_attempts.fails + 1,
         locked_until = case when login_attempts.fails + 1 >= ${MAX_FAILS}
                             then now() + interval '${LOCK_MINUTES} minutes' else null end,
         updated_at = now()`,
      [email],
    );
    redirect("/login?error=" + encodeURIComponent("อีเมลหรือรหัสผ่านไม่ถูกต้อง"));
  }

  // สำเร็จ → ล้างประวัติความล้มเหลว
  await query("delete from login_attempts where email=$1", [email]);
  await createSession(user.id);
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signupAction(formData: FormData) {
  const shopName = String(formData.get("shop_name") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const phoneRaw = String(formData.get("phone") ?? "").replace(/[\s-]/g, "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");
  const tos = formData.get("tos");

  // ----- rate-limit ตาม IP (sliding window 1 ชม.) -----
  const ip = await clientIp();
  const rl = await one<{ count: number }>(
    `insert into signup_attempts (ip, count, window_start) values ($1, 1, now())
     on conflict (ip) do update set
       count = case when signup_attempts.window_start < now() - interval '1 hour'
                    then 1 else signup_attempts.count + 1 end,
       window_start = case when signup_attempts.window_start < now() - interval '1 hour'
                           then now() else signup_attempts.window_start end
     returning count`,
    [ip],
  );
  if ((rl?.count ?? 0) > MAX_SIGNUPS_PER_IP) {
    signupError("มีการสมัครจากเครือข่ายนี้บ่อยเกินไป — ลองใหม่ภายหลัง");
  }

  // ----- ตรวจความถูกต้อง -----
  if (!shopName) signupError("กรุณากรอกชื่อร้าน");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) signupError("อีเมลไม่ถูกต้อง");
  if (phoneRaw && !/^0\d{8,9}$/.test(phoneRaw))
    signupError("เบอร์โทรไม่ถูกต้อง (เช่น 0812345678)");
  if (password.length < PASSWORD_MIN_LENGTH)
    signupError(`รหัสผ่านอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`);
  if (scorePassword(password) < PASSWORD_MIN_SCORE)
    signupError("รหัสผ่านคาดเดาง่ายเกินไป — ผสมตัวอักษรและตัวเลข");
  if (password !== confirm) signupError("รหัสผ่านยืนยันไม่ตรงกัน");
  if (!tos) signupError("กรุณายอมรับข้อตกลงการใช้งานและนโยบายความเป็นส่วนตัว");

  const existing = await one("select id from users where email = $1", [email]);
  if (existing) signupError("อีเมลนี้ถูกใช้แล้ว");

  const hash = await hashPassword(password);
  const user = await one<{ id: string }>(
    `insert into users (email, password_hash, full_name, phone, tos_accepted_at)
     values ($1, $2, $3, $4, now()) returning id`,
    [email, hash, fullName || null, phoneRaw || null],
  );

  // สร้างร้าน + เป็น owner + trial 14 วัน
  const org = await one<{ create_organization: string }>(
    "select create_organization($1, $2, $3)",
    [user!.id, shopName, null],
  );

  await logAudit(org!.create_organization, user!.id, "signup", `email=${email}`);

  await createSession(user!.id);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOutAction() {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/login");
}

// ============================================================
// ลืมรหัสผ่าน — สำหรับผู้ใช้ที่สมัครด้วยอีเมล/รหัสผ่านเท่านั้น
// ============================================================

/** ขอลิงก์รีเซ็ตรหัสผ่าน (กรอกอีเมล) */
export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/forgot-password?error=" + encodeURIComponent("อีเมลไม่ถูกต้อง"));
  }

  const user = await one<{
    id: string;
    password_hash: string | null;
    google_sub: string | null;
  }>("select id, password_hash, google_sub from users where email = $1", [email]);

  // เคสบัญชี Google ล้วน (ไม่มีรหัสผ่านให้รีเซ็ต) → แจ้งบนหน้าจอให้ไปใช้ Google
  if (user && !user.password_hash && user.google_sub) {
    redirect("/forgot-password?google=1");
  }

  // rate-limit ต่ออีเมล (sliding window 15 นาที)
  const rl = await one<{ count: number }>(
    `insert into password_reset_attempts (email, count, window_start) values ($1, 1, now())
     on conflict (email) do update set
       count = case when password_reset_attempts.window_start < now() - interval '${RESET_WINDOW_MINUTES} minutes'
                    then 1 else password_reset_attempts.count + 1 end,
       window_start = case when password_reset_attempts.window_start < now() - interval '${RESET_WINDOW_MINUTES} minutes'
                           then now() else password_reset_attempts.window_start end
     returning count`,
    [email],
  );
  const limited = (rl?.count ?? 0) > RESET_MAX_PER_WINDOW;

  // ส่งเมลเฉพาะเมื่อ: มี user + มีรหัสผ่านจริง + ยังไม่เกินลิมิต
  if (user && user.password_hash && !limited) {
    // ยกเลิก token เก่าที่ยังไม่ถูกใช้ของผู้ใช้คนนี้
    await query(
      "update password_reset_tokens set used_at = now() where user_id = $1 and used_at is null",
      [user.id],
    );
    const { token, hash } = newResetToken();
    await query(
      `insert into password_reset_tokens (token_hash, user_id, expires_at)
       values ($1, $2, now() + interval '${RESET_TOKEN_MINUTES} minutes')`,
      [hash, user.id],
    );
    await sendPasswordResetEmail(
      email,
      `${siteUrl()}/reset-password?token=${token}`,
    );
  }

  // ตอบกลางๆ เสมอ ไม่เปิดเผยว่ามีอีเมลนี้ในระบบหรือไม่ (กัน account enumeration)
  redirect("/forgot-password?sent=1");
}

/** ตั้งรหัสผ่านใหม่จากลิงก์ในอีเมล */
export async function resetPasswordAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  const formError = (msg: string): never =>
    redirect(
      `/reset-password?token=${encodeURIComponent(token)}&error=${encodeURIComponent(msg)}`,
    );

  if (password.length < PASSWORD_MIN_LENGTH)
    formError(`รหัสผ่านอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`);
  if (scorePassword(password) < PASSWORD_MIN_SCORE)
    formError("รหัสผ่านคาดเดาง่ายเกินไป — ผสมตัวอักษรและตัวเลข");
  if (password !== confirm) formError("รหัสผ่านยืนยันไม่ตรงกัน");

  const hash = hashToken(token);
  const row = await one<{ user_id: string }>(
    `select user_id from password_reset_tokens
      where token_hash = $1 and used_at is null and expires_at > now()`,
    [hash],
  );

  // token ไม่ถูกต้อง/หมดอายุ/ถูกใช้ไปแล้ว → กลับไปหน้า reset แบบ invalid
  if (!row) redirect("/reset-password?invalid=1");

  const newHash = await hashPassword(password);
  await query("update users set password_hash = $1 where id = $2", [
    newHash,
    row!.user_id,
  ]);
  // ใช้ token ครั้งเดียว
  await query(
    "update password_reset_tokens set used_at = now() where token_hash = $1",
    [hash],
  );
  // เตะ session อื่นทั้งหมด (เผื่อบัญชีถูกเข้าถึงโดยไม่ได้รับอนุญาต) + ล้าง lock จากการล็อกอินผิด
  await query("delete from sessions where user_id = $1", [row!.user_id]);
  await query(
    "delete from login_attempts where email = (select email from users where id = $1)",
    [row!.user_id],
  );

  redirect(
    "/login?message=" +
      encodeURIComponent("เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่"),
  );
}
