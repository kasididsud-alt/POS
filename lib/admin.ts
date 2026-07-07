// ผู้ดูแลระบบระดับแพลตฟอร์ม (คนละเรื่องกับ role owner/cashier ในร้าน)
// ระบุตัวด้วย env ADMIN_EMAILS (คั่นด้วย comma) — ไม่ต้องแก้ DB
//   ADMIN_EMAILS=you@example.com,teammate@example.com
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

export type AdminUser = { id: string; email: string; full_name: string | null };

/** รายชื่ออีเมลผู้ดูแลระบบจาก env (ตัวพิมพ์เล็กทั้งหมด) */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** เปิดใช้ระบบ admin แล้วหรือยัง (มีอย่างน้อย 1 อีเมล) */
export function adminConfigured(): boolean {
  return adminEmails().length > 0;
}

/** อีเมลนี้เป็นผู้ดูแลระบบไหม */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

/** ใช้ในหน้า/layout ของ (admin) — เด้งออกถ้าไม่ใช่ผู้ดูแลระบบ */
export async function requireAdminPage(): Promise<AdminUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (!isAdminEmail(user.email)) redirect("/dashboard");
  return user;
}

/** ใช้ใน server action — โยน error ถ้าไม่ใช่ผู้ดูแลระบบ */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getSessionUser();
  if (!user || !isAdminEmail(user.email))
    throw new Error("เฉพาะผู้ดูแลระบบเท่านั้น");
  return user;
}
