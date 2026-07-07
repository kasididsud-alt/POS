import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

const DB = process.env.DATABASE_URL;

// รันเฉพาะเมื่อมี DATABASE_URL (เช่น local dev / CI) — ไม่งั้น skip
// ทุกเทสต์ห่อใน transaction แล้ว rollback → ไม่แตะข้อมูลจริง
test(
  "checkout_sale ตัดสต็อกเฉพาะสาขาที่ขาย และกันขายข้ามสาขา",
  { skip: DB ? false : "ไม่มี DATABASE_URL — ข้าม integration test" },
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
         where ps.qty >= 2 limit 1`);
      if (!row) {
        await c.query("rollback");
        return; // ไม่มีข้อมูลพอ — ถือว่าผ่าน (nothing to assert)
      }
      const { product_id, a: branchA, org_id, name } = row;

      const bal = async (br: string) =>
        (
          await one(
            "select coalesce(qty,0)::int q from product_stock where product_id=$1 and branch_id=$2",
            [product_id, br],
          )
        )?.q ?? 0;

      const before = await bal(branchA);

      // ขาย 1 ชิ้นที่สาขา A
      await c.query(
        "select checkout_sale($1,$2::jsonb,$3,$4,$5,$6,$7,$8)",
        [
          org_id,
          JSON.stringify([{ product_id, name, unit_price: 10, qty: 1 }]),
          "cash",
          0,
          1000,
          null,
          null,
          branchA,
        ],
      );
      assert.equal(await bal(branchA), before - 1, "สต็อกสาขา A ต้องลด 1");

      // สาขา B ใหม่ (สต็อก 0) — ขายสินค้าเดิมต้อง error (ข้ามสาขาไม่ได้)
      const b = await one(
        "insert into branches (org_id, name, type) values ($1,'B-test','shop') returning id",
        [org_id],
      );
      let blocked = false;
      try {
        await c.query(
          "select checkout_sale($1,$2::jsonb,$3,$4,$5,$6,$7,$8)",
          [
            org_id,
            JSON.stringify([{ product_id, name, unit_price: 10, qty: 1 }]),
            "cash",
            0,
            1000,
            null,
            null,
            b.id,
          ],
        );
      } catch {
        blocked = true;
      }
      assert.ok(blocked, "ขายที่สาขา B (สต็อก 0) ต้องถูกบล็อก");

      await c.query("rollback");
    } finally {
      await c.end();
    }
  },
);
