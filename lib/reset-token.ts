import { randomBytes, createHash } from "node:crypto";

// token รีเซ็ตรหัสผ่าน:
// - ส่ง "ตัวจริง" (token) ไปในลิงก์ทางอีเมลเท่านั้น
// - เก็บแค่ sha256(token) ลง DB → ต่อให้ DB หลุด ก็เอา token ไปใช้ไม่ได้

/** สร้าง token ใหม่ คืนทั้งตัวจริง (ใส่ในลิงก์) และ hash (เก็บลง DB) */
export function newResetToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, hash: hashToken(token) };
}

/** hash token ด้วย sha256 (deterministic เพื่อใช้ค้นใน DB ได้) */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
