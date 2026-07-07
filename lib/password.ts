import bcrypt from "bcryptjs";

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * ให้คะแนนความแข็งแรงรหัสผ่าน 0–4 (ฟังก์ชันบริสุทธิ์ ใช้ได้ทั้งฝั่ง client/server)
 * - client: ใช้แสดง strength meter
 * - server: ใช้บังคับขั้นต่ำตอนสมัคร
 */
export function scorePassword(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MIN_SCORE = 2;
