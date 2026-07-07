import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { query, one } from "./db";

const COOKIE = "session";
const MAX_AGE_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  full_name: string | null;
};

/** สร้าง session + ตั้ง cookie */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  await query(
    "insert into sessions (token, user_id, expires_at) values ($1, $2, $3)",
    [token, userId, expires],
  );
  const c = await cookies();
  c.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
    // เปิด Secure เฉพาะเมื่อ deploy บน HTTPS จริง (ตั้ง COOKIE_SECURE=true)
    // ไม่งั้น cookie จะไม่ถูกส่งบน http://localhost ทำให้ล็อกอินไม่ติด
    secure: process.env.COOKIE_SECURE === "true",
  });
}

/** อ่านผู้ใช้จาก session cookie (null ถ้าไม่มี/หมดอายุ) */
export async function getSessionUser(): Promise<SessionUser | null> {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (!token) return null;
  return one<SessionUser>(
    `select u.id, u.email, u.full_name
       from sessions s join users u on u.id = s.user_id
      where s.token = $1 and s.expires_at > now()`,
    [token],
  );
}

/** ลบ session ปัจจุบัน */
export async function destroySession(): Promise<void> {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (token) {
    await query("delete from sessions where token = $1", [token]);
    c.delete(COOKIE);
  }
}
