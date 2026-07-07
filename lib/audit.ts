import { query } from "@/lib/db";

/** บันทึก audit log (best-effort — ไม่ throw ถ้าล้มเหลว) */
export async function logAudit(
  orgId: string,
  userId: string | null,
  action: string,
  detail?: string,
): Promise<void> {
  try {
    await query(
      "insert into audit_logs (org_id, user_id, action, detail) values ($1,$2,$3,$4)",
      [orgId, userId, action, detail ?? null],
    );
  } catch {
    // ไม่ให้ audit ทำให้ flow หลักพัง
  }
}
