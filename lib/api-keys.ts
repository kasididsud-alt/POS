import crypto from "node:crypto";
import { one, query } from "@/lib/db";
import type { Organization } from "@/lib/types";

const PREFIX = "kds_live_";

/** สร้าง API key ใหม่ — คืน key เต็ม (โชว์ครั้งเดียว) + prefix + hash ไว้เก็บ */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const rand = crypto.randomBytes(24).toString("base64url");
  const key = PREFIX + rand;
  return { key, prefix: key.slice(0, 16), hash: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/** ยืนยัน key จาก header `Authorization: Bearer <key>` → คืน org หรือ null */
export async function authenticateApiKey(
  authHeader: string | null,
): Promise<Organization | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const key = authHeader.slice(7).trim();
  if (!key.startsWith(PREFIX)) return null;

  const row = await one<{ id: string; org_id: string }>(
    "select id, org_id from api_keys where key_hash=$1 and revoked_at is null",
    [hashApiKey(key)],
  );
  if (!row) return null;

  // อัปเดตเวลาใช้ล่าสุด (ไม่บล็อก response ถ้าพลาด)
  query("update api_keys set last_used_at=now() where id=$1", [row.id]).catch(
    () => {},
  );

  return one<Organization>("select * from organizations where id=$1", [
    row.org_id,
  ]);
}
