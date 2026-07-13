import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

const DB = process.env.DATABASE_URL;
const skip = DB ? false : "ไม่มี DATABASE_URL — ข้าม integration test";

// เลข PO/SO ต้องไม่ซ้ำแม้ยิงพร้อมกัน (db/modules/28_unique_po_so_no.sql)
// แนวเดียวกับ integration.billno.test.ts: ต้อง commit จริงหลาย connection
// → seed org แยกแล้วลบทิ้งใน finally (ตารางลูก cascade จาก organizations)

async function seedCommitted(c: pg.Client, name: string) {
  const one = async (sql: string, p: unknown[] = []) =>
    (await c.query(sql, p)).rows[0];
  const org = await one(
    "insert into organizations (name) values ($1) returning id",
    [name],
  );
  const product = await one(
    "insert into products (org_id, name, price, cost) values ($1,'สินค้า docno',100,60) returning id",
    [org.id],
  );
  return { orgId: org.id as string, productId: product.id as string };
}

test("create_po พร้อมกันหลาย request — po_no ต้องไม่ซ้ำ + format ถูก", { skip }, async () => {
  const admin = new pg.Client({ connectionString: DB });
  await admin.connect();
  let orgId: string | null = null;
  try {
    const s = await seedCommitted(admin, "pono-concurrent-test");
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
      await Promise.all(
        clients.map((c) =>
          c.query("select create_po($1,$2,$3::jsonb,$4,$5)", [
            s.orgId, null,
            JSON.stringify([{ product_id: s.productId, qty: 2, unit_cost: 60 }]),
            null, null,
          ]),
        ),
      );
    } finally {
      await Promise.all(clients.map((c) => c.end()));
    }

    const rows = await admin.query(
      "select po_no from purchase_orders where org_id=$1",
      [s.orgId],
    );
    const nos = rows.rows.map((r) => r.po_no as string);
    assert.equal(nos.length, N, "ต้องสร้าง PO ครบทุก request");
    assert.equal(new Set(nos).size, N, `po_no ซ้ำ: ${nos.sort().join(", ")}`);
    for (const no of nos) {
      assert.match(no, /^PO\d{6}-\d{4}$/, `format po_no ผิด: ${no}`);
    }
  } finally {
    if (orgId) await admin.query("delete from organizations where id=$1", [orgId]);
    await admin.end();
  }
});

test("create_sales_order พร้อมกันหลาย request — so_no ต้องไม่ซ้ำ + format ถูก", { skip }, async () => {
  const admin = new pg.Client({ connectionString: DB });
  await admin.connect();
  let orgId: string | null = null;
  try {
    const s = await seedCommitted(admin, "sono-concurrent-test");
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
      await Promise.all(
        clients.map((c) =>
          c.query("select create_sales_order($1,$2,$3::jsonb,$4,$5)", [
            s.orgId, null,
            JSON.stringify([{ product_id: s.productId, name: "สินค้า docno", unit_price: 100, qty: 1 }]),
            null, null,
          ]),
        ),
      );
    } finally {
      await Promise.all(clients.map((c) => c.end()));
    }

    const rows = await admin.query(
      "select so_no from sales_orders where org_id=$1",
      [s.orgId],
    );
    const nos = rows.rows.map((r) => r.so_no as string);
    assert.equal(nos.length, N, "ต้องสร้าง SO ครบทุก request");
    assert.equal(new Set(nos).size, N, `so_no ซ้ำ: ${nos.sort().join(", ")}`);
    for (const no of nos) {
      assert.match(no, /^SO\d{6}-\d{4}$/, `format so_no ผิด: ${no}`);
    }
  } finally {
    if (orgId) await admin.query("delete from organizations where id=$1", [orgId]);
    await admin.end();
  }
});

test("เลข PO/SO แยกรันต่อ org — org ใหม่เริ่ม 0001 ของเดือนนี้", { skip }, async () => {
  const admin = new pg.Client({ connectionString: DB });
  await admin.connect();
  const orgIds: string[] = [];
  try {
    const a = await seedCommitted(admin, "docno-org-a");
    orgIds.push(a.orgId);
    const b = await seedCommitted(admin, "docno-org-b");
    orgIds.push(b.orgId);

    // org A สร้าง 2 ใบก่อน — org B ต้องยังเริ่มที่ 0001 ของตัวเอง
    for (const _ of [1, 2]) {
      await admin.query("select create_po($1,$2,$3::jsonb)", [
        a.orgId, null,
        JSON.stringify([{ product_id: a.productId, qty: 1, unit_cost: 60 }]),
      ]);
      await admin.query("select create_sales_order($1,$2,$3::jsonb)", [
        a.orgId, null,
        JSON.stringify([{ product_id: a.productId, name: "x", unit_price: 100, qty: 1 }]),
      ]);
    }
    await admin.query("select create_po($1,$2,$3::jsonb)", [
      b.orgId, null,
      JSON.stringify([{ product_id: b.productId, qty: 1, unit_cost: 60 }]),
    ]);
    await admin.query("select create_sales_order($1,$2,$3::jsonb)", [
      b.orgId, null,
      JSON.stringify([{ product_id: b.productId, name: "y", unit_price: 100, qty: 1 }]),
    ]);

    const ym = new Date().toISOString().slice(0, 7).replace("-", "");
    const poB = await admin.query(
      "select po_no from purchase_orders where org_id=$1",
      [b.orgId],
    );
    assert.equal(poB.rows[0].po_no, `PO${ym}-0001`);
    const soB = await admin.query(
      "select so_no from sales_orders where org_id=$1",
      [b.orgId],
    );
    assert.equal(soB.rows[0].so_no, `SO${ym}-0001`);

    // org A ต้องนับของตัวเองต่อเนื่อง 0001,0002
    const poA = await admin.query(
      "select po_no from purchase_orders where org_id=$1 order by po_no",
      [a.orgId],
    );
    assert.deepEqual(
      poA.rows.map((r) => r.po_no),
      [`PO${ym}-0001`, `PO${ym}-0002`],
    );
  } finally {
    for (const id of orgIds) {
      await admin.query("delete from organizations where id=$1", [id]);
    }
    await admin.end();
  }
});
