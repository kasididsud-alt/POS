import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

const DB = process.env.DATABASE_URL;
const skip = DB ? false : "ไม่มี DATABASE_URL — ข้าม integration test";

// เทสต์โมดูล 31: points ตรงกับที่บันทึกจริง, debts.sale_id, fulfill_sales_order ตัดสต็อก
// ทุกเทสต์ห่อใน transaction แล้ว rollback → ไม่แตะข้อมูลจริง

type Q = (sql: string, p?: unknown[]) => Promise<Record<string, unknown>>;

async function fixture(c: pg.Client) {
  const one: Q = async (sql, p = []) => (await c.query(sql, p)).rows[0];
  const org = await one(
    "insert into organizations (name) values ('ทดสอบโมดูล31') returning id",
  );
  const branch = await one(
    "insert into branches (org_id, name, type, is_default) values ($1,'หลัก','shop',true) returning id",
    [org.id],
  );
  const prod = await one(
    "insert into products (org_id, name, price, cost) values ($1,'สินค้าเทสต์',100,60) returning id, name",
    [org.id],
  );
  // ตั้งสต็อกตั้งต้น 10 ชิ้นที่สาขาหลัก
  await c.query(
    `insert into stock_movements (org_id, product_id, branch_id, qty_change, reason, note)
     values ($1,$2,$3,10,'adjust','ตั้งต้นเทสต์')`,
    [org.id, prod.id, branch.id],
  );
  const cust = await one(
    "insert into customers (org_id, name) values ($1,'ลูกค้าเทสต์') returning id",
    [org.id],
  );
  const stock = async () =>
    Number(
      (
        await one(
          "select coalesce(sum(qty_change),0)::int q from stock_movements where product_id=$1 and branch_id=$2",
          [prod.id, branch.id],
        )
      ).q,
    );
  return { one, org, branch, prod, cust, stock };
}

test("checkout_sale: ไม่มีลูกค้า → points ที่ return ต้องเป็น 0 (ไม่หลอก UI)", { skip }, async () => {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try {
    await c.query("begin");
    const f = await fixture(c);

    const r = await f.one(
      "select checkout_sale($1,$2::jsonb,'cash',0,1000,null,null,$3) as r",
      [f.org.id, JSON.stringify([{ product_id: f.prod.id, qty: 3 }]), f.branch.id],
    );
    const res = r.r as { total: number; points: number };
    assert.equal(Number(res.total), 300);
    assert.equal(Number(res.points), 0, "ไม่มีลูกค้า points ต้องเป็น 0");

    // มีลูกค้า → points ตาม floor(total/100) และบันทึกเข้าตัวลูกค้าจริง
    const r2 = await f.one(
      "select checkout_sale($1,$2::jsonb,'cash',0,1000,null,$3,$4) as r",
      [f.org.id, JSON.stringify([{ product_id: f.prod.id, qty: 2 }]), f.cust.id, f.branch.id],
    );
    const res2 = r2.r as { points: number };
    assert.equal(Number(res2.points), 2, "ยอด 200 ต้องได้ 2 แต้ม");
    const pts = await f.one("select points from customers where id=$1", [f.cust.id]);
    assert.equal(Number(pts.points), 2, "แต้มต้องถูกบันทึกที่ลูกค้าจริง");

    await c.query("rollback");
  } finally {
    await c.end();
  }
});

test("checkout_sale ขายเชื่อ: debts ผูก sale_id ตรงกับบิล", { skip }, async () => {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try {
    await c.query("begin");
    const f = await fixture(c);

    const r = await f.one(
      "select checkout_sale($1,$2::jsonb,'credit',0,null,null,$3,$4) as r",
      [f.org.id, JSON.stringify([{ product_id: f.prod.id, qty: 1 }]), f.cust.id, f.branch.id],
    );
    const res = r.r as { sale_id: string; bill_no: string };

    const debt = await f.one(
      "select sale_id, amount, note from debts where org_id=$1 and customer_id=$2",
      [f.org.id, f.cust.id],
    );
    assert.equal(debt.sale_id, res.sale_id, "debts.sale_id ต้องชี้บิลที่สร้าง");
    assert.equal(Number(debt.amount), 100);
    assert.equal(debt.note, `ขายเชื่อ บิล ${res.bill_no}`, "note คงรูปแบบเดิม (process_return ใช้)");

    await c.query("rollback");
  } finally {
    await c.end();
  }
});

test("fulfill_sales_order: ตัดสต็อกถูกจำนวน และกดซ้ำไม่ตัดซ้ำ", { skip }, async () => {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try {
    await c.query("begin");
    const f = await fixture(c);

    const so = await f.one(
      "select create_sales_order($1,$2,$3::jsonb) as id",
      [
        f.org.id,
        f.cust.id,
        JSON.stringify([
          { product_id: f.prod.id, name: "สินค้าเทสต์", unit_price: 100, qty: 4 },
        ]),
      ],
    );

    assert.equal(await f.stock(), 10);
    await c.query("select fulfill_sales_order($1,$2,null,$3)", [
      f.org.id,
      so.id,
      f.branch.id,
    ]);
    assert.equal(await f.stock(), 6, "ส่งมอบ 4 ชิ้น สต็อกต้องเหลือ 6");

    const st = await f.one("select status from sales_orders where id=$1", [so.id]);
    assert.equal(st.status, "fulfilled");

    // กดซ้ำ → ต้อง error และสต็อกไม่ขยับ (ใช้ savepoint ให้ transaction ไปต่อได้)
    await c.query("savepoint s1");
    let blocked = false;
    try {
      await c.query("select fulfill_sales_order($1,$2,null,$3)", [
        f.org.id,
        so.id,
        f.branch.id,
      ]);
    } catch {
      blocked = true;
      await c.query("rollback to savepoint s1");
    }
    assert.ok(blocked, "fulfill ซ้ำต้องถูกบล็อก");
    assert.equal(await f.stock(), 6, "สต็อกต้องไม่ถูกตัดซ้ำ");

    await c.query("rollback");
  } finally {
    await c.end();
  }
});

test("fulfill_sales_order: ของไม่พอ → ล้มทั้งใบ สถานะไม่เปลี่ยน", { skip }, async () => {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try {
    await c.query("begin");
    const f = await fixture(c);

    const so = await f.one("select create_sales_order($1,$2,$3::jsonb) as id", [
      f.org.id,
      f.cust.id,
      JSON.stringify([
        { product_id: f.prod.id, name: "สินค้าเทสต์", unit_price: 100, qty: 99 },
      ]),
    ]);

    await c.query("savepoint s1");
    let blocked = false;
    try {
      await c.query("select fulfill_sales_order($1,$2,null,$3)", [
        f.org.id,
        so.id,
        f.branch.id,
      ]);
    } catch {
      blocked = true;
      await c.query("rollback to savepoint s1");
    }
    assert.ok(blocked, "ของไม่พอต้อง error");
    assert.equal(await f.stock(), 10, "สต็อกต้องไม่ถูกตัด");
    const st = await f.one("select status from sales_orders where id=$1", [so.id]);
    assert.equal(st.status, "open", "สถานะต้อง rollback กลับ open");

    await c.query("rollback");
  } finally {
    await c.end();
  }
});

test("fulfill_sales_order: ข้าม org ไม่ได้", { skip }, async () => {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try {
    await c.query("begin");
    const f = await fixture(c);
    const evil = await f.one(
      "insert into organizations (name) values ('ร้านอื่น') returning id",
    );
    const evilBranch = await f.one(
      "insert into branches (org_id, name, type) values ($1,'สาขาร้านอื่น','shop') returning id",
      [evil.id],
    );

    const so = await f.one("select create_sales_order($1,$2,$3::jsonb) as id", [
      f.org.id,
      f.cust.id,
      JSON.stringify([
        { product_id: f.prod.id, name: "สินค้าเทสต์", unit_price: 100, qty: 1 },
      ]),
    ]);

    await c.query("savepoint s1");
    let blocked = false;
    try {
      await c.query("select fulfill_sales_order($1,$2,null,$3)", [
        evil.id, // org อื่นพยายามส่งมอบออเดอร์ของเรา
        so.id,
        evilBranch.id,
      ]);
    } catch {
      blocked = true;
      await c.query("rollback to savepoint s1");
    }
    assert.ok(blocked, "org อื่นต้อง fulfill ออเดอร์เราไม่ได้");
    const st = await f.one("select status from sales_orders where id=$1", [so.id]);
    assert.equal(st.status, "open");

    await c.query("rollback");
  } finally {
    await c.end();
  }
});
