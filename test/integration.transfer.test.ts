import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

const DB = process.env.DATABASE_URL;

// โอนย้ายสต็อกระหว่างสาขา — ตัดต้นทางตอนสร้าง, เพิ่มปลายทางตอนรับ, กันโอนเกิน
test(
  "transfer ขยับสต็อกรายสาขาถูกต้อง (create/receive/oversell)",
  { skip: DB ? false : "ไม่มี DATABASE_URL — ข้าม" },
  async () => {
    const c = new pg.Client({ connectionString: DB });
    await c.connect();
    try {
      await c.query("begin");
      const one = async (sql: string, p: unknown[] = []) =>
        (await c.query(sql, p)).rows[0];

      const row = await one(`
        select ps.product_id, ps.branch_id as a, p.org_id, p.name, ps.qty
          from product_stock ps join products p on p.id = ps.product_id
         where ps.qty >= 5 limit 1`);
      if (!row) {
        await c.query("rollback");
        return;
      }
      const { product_id, a: from, org_id, name } = row;
      const to = (
        await one(
          "insert into branches (org_id,name,type) values ($1,'B-tf','shop') returning id",
          [org_id],
        )
      ).id;

      const bal = async (br: string) =>
        (
          await one(
            "select coalesce(qty,0)::int q from product_stock where product_id=$1 and branch_id=$2",
            [product_id, br],
          )
        )?.q ?? 0;

      const a0 = await bal(from);

      // สร้างใบโอน 5 ชิ้น → ตัดต้นทางทันที
      const tid = (
        await one("select create_transfer($1,$2,$3,$4::jsonb,$5,$6) id", [
          org_id,
          from,
          to,
          JSON.stringify([{ product_id, name, qty: 5 }]),
          "test",
          null,
        ])
      ).id;
      assert.equal(await bal(from), a0 - 5, "ต้นทางต้องลด 5 ตอนสร้าง");
      assert.equal(await bal(to), 0, "ปลายทางยังไม่เพิ่ม (in-transit)");

      // รับโอน → เพิ่มปลายทาง
      await c.query("select receive_transfer($1,$2)", [tid, null]);
      assert.equal(await bal(from), a0 - 5);
      assert.equal(await bal(to), 5, "ปลายทางต้องได้ 5 ตอนรับ");

      // กันโอนเกินสต็อก
      let blocked = false;
      try {
        await c.query("select create_transfer($1,$2,$3,$4::jsonb,$5,$6)", [
          org_id,
          to,
          from,
          JSON.stringify([{ product_id, name, qty: 99999 }]),
          null,
          null,
        ]);
      } catch {
        blocked = true;
      }
      assert.ok(blocked, "โอนเกินสต็อกต้องถูกบล็อก");

      await c.query("rollback");
    } finally {
      await c.end();
    }
  },
);
