import { Pool, types } from "pg";

// numeric/decimal (OID 1700) → เลขทศนิยม (ไม่งั้น pg คืนเป็น string)
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
// date (OID 1082) → คงเป็น string 'YYYY-MM-DD' (ไม่แปลงเป็น Date object)
types.setTypeParser(1082, (v) => v);

const globalForPg = globalThis as unknown as { __pgPool?: Pool };

export const isDbConfigured = !!process.env.DATABASE_URL;

export const pool: Pool =
  globalForPg.__pgPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

if (process.env.NODE_ENV !== "production") globalForPg.__pgPool = pool;

/** query → คืน array ของ rows */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await pool.query(text, params as unknown[]);
  return res.rows as T[];
}

/** query → คืนแถวแรก หรือ null */
export async function one<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** query helpers ที่ผูกกับ connection เดียว — ใช้ภายใน withTx */
export type Tx = {
  query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;
  one: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T | null>;
};

/**
 * รัน fn ใน transaction เดียว (connection เดียวตลอด) แล้ว commit/rollback ให้
 * — จำเป็นกับงาน lock+check+insert (เช่นโควตาตามแพ็ก) ที่ต้อง atomic
 *   pg_advisory_xact_lock จะถูกปล่อยเองตอนจบ transaction
 */
export async function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const q = async <R,>(text: string, params?: unknown[]) =>
      (await client.query(text, params as unknown[])).rows as R[];
    const result = await fn({
      query: q,
      one: async (text, params) => (await q(text, params))[0] ?? null,
    } as Tx);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => {
      /* connection พังไปแล้ว — pool จะทิ้ง client เอง */
    });
    throw e;
  } finally {
    client.release();
  }
}
