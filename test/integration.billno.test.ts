import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

const DB = process.env.DATABASE_URL;
const skip = DB ? false : "ไม่มี DATABASE_URL — ข้าม integration test";

// เลขบิล/เลขใบโอนต้องไม่ซ้ำแม้ยิงพร้อมกัน (db/modules/25_unique_bill_no.sql)
// เทสต์นี้ต้อง commit จริง (หลาย connection มองเห็นกันไม่ได้ใน tx เดียว)
// → seed org แยกแล้วลบทิ้งใน finally (FK ทุกตารางลูก cascade จาก organizations)

async function seedCommitted(c: pg.Client, name: string) {
  const one = async (sql: string, p: unknown[] = []) =>
    (await c.query(sql, p)).rows[0];
  const org = await one(
    "insert into organizations (name) values ($1) returning id",
    [name],
  );
  const branchA = await one(
    "insert into branches (org_id, name, type, is_default) values ($1,'สาขาหลัก','shop',true) returning id",
    [org.id],
  );
  const branchB = await one(
    "insert into branches (org_id, name, type) values ($1,'สาขาสอง','shop') returning id",
    [org.id],
  );
  const product = await one(
    "insert into products (org_id, name, price) values ($1,'สินค้า concurrent',100) returning id",
    [org.id],
  );
  await c.query(
    "insert into stock_movements (org_id, product_id, branch_id, qty_change, reason) values ($1,$2,$3,1000,'adjust')",
    [org.id, product.id, branchA.id],
  );
  return {
    orgId: org.id as string,
    branchA: branchA.id as string,
    branchB: branchB.id as string,
    productId: product.id as string,
  };
}

test("checkout_sale พร้อมกันหลาย request — เลขบิลต้องไม่ซ้ำ", { skip }, async () => {
  const admin = new pg.Client({ connectionString: DB });
  await admin.connect();
  let orgId: string | null = null;
  try {
    const s = await seedCommitted(admin, "billno-concurrent-test");
    orgId = s.orgId;

    const N = 8;
    const clients = await Promise.all(
      Array.from({ length: N }, async () => {
        const c = new pg.Client({ connectionString: DB });
        await c.connect();
        return c;
      }),
    );
    try {
      const results = await Promise.all(
        clients.map((c) =>
          c.query("select checkout_sale($1,$2::jsonb,$3,$4,$5,$6,$7,$8) as r", [
            s.orgId,
            JSON.stringify([{ product_id: s.productId, qty: 1 }]),
            "cash", 0, 1000, null, null, s.branchA,
          ]),
        ),
      );
      const bills = results.map((r) => r.rows[0].r.bill_no as string);
      assert.equal(new Set(bills).size, N, `เลขบิลซ้ำ: ${bills.sort().join(", ")}`);
    } finally {
      await Promise.all(clients.map((c) => c.end()));
    }

    // ยืนยันใน DB ด้วย (กัน RPC ตอบเลขหนึ่งแต่บันทึกอีกเลข)
    const dup = await admin.query(
      "select bill_no, count(*) n from sales where org_id=$1 group by bill_no having count(*) > 1",
      [s.orgId],
    );
    assert.equal(dup.rows.length, 0, "ห้ามมี bill_no ซ้ำใน DB");
  } finally {
    if (orgId) await admin.query("delete from organizations where id=$1", [orgId]);
    await admin.end();
  }
});

test("create_transfer พร้อมกันหลาย request — transfer_no ต้องไม่ซ้ำ", { skip }, async () => {
  const admin = new pg.Client({ connectionString: DB });
  await admin.connect();
  let orgId: string | null = null;
  try {
    const s = await seedCommitted(admin, "transferno-concurrent-test");
    orgId = s.orgId;

    const N = 6;
    const clients = await Promise.all(
      Array.from({ length: N }, async () => {
        const c = new pg.Client({ connectionString: DB });
        await c.connect();
        return c;
      }),
    );
    try {
      await Promise.all(
        clients.map((c) =>
          c.query("select create_transfer($1,$2,$3,$4::jsonb,$5,$6)", [
            s.orgId, s.branchA, s.branchB,
            JSON.stringify([{ product_id: s.productId, name: "สินค้า concurrent", qty: 1 }]),
            null, null,
          ]),
        ),
      );
    } finally {
      await Promise.all(clients.map((c) => c.end()));
    }

    const dup = await admin.query(
      "select transfer_no, count(*) n from stock_transfers where org_id=$1 group by transfer_no having count(*) > 1",
      [s.orgId],
    );
    assert.equal(dup.rows.length, 0, "ห้ามมี transfer_no ซ้ำใน DB");
  } finally {
    if (orgId) await admin.query("delete from organizations where id=$1", [orgId]);
    await admin.end();
  }
});
