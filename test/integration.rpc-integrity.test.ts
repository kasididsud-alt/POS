import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

const DB = process.env.DATABASE_URL;
const skip = DB ? false : "ไม่มี DATABASE_URL — ข้าม integration test";

type Client = InstanceType<typeof pg.Client>;

async function withTx(fn: (c: Client) => Promise<void>) {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try {
    await c.query("begin");
    await fn(c);
    await c.query("rollback");
  } finally {
    await c.end();
  }
}

async function seedShop(c: Client, name = "ร้าน rpc-integrity") {
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
    "insert into products (org_id, name, price) values ($1,'สินค้าทดสอบ',100) returning id",
    [org.id],
  );
  const customer = await one(
    "insert into customers (org_id, name) values ($1,'ลูกค้าทดสอบ') returning id",
    [org.id],
  );
  await c.query(
    "insert into stock_movements (org_id, product_id, branch_id, qty_change, reason) values ($1,$2,$3,100,'adjust')",
    [org.id, product.id, branchA.id],
  );
  return {
    orgId: org.id as string,
    branchA: branchA.id as string,
    branchB: branchB.id as string,
    productId: product.id as string,
    customerId: customer.id as string,
  };
}

const CHECKOUT = "select checkout_sale($1,$2::jsonb,$3,$4,$5,$6,$7,$8) as r";
const RETURN = "select process_return($1,$2,$3::jsonb,$4,$5,$6) as r";

async function mustThrow(p: Promise<unknown>, label: string) {
  let threw = false;
  try {
    await p;
  } catch {
    threw = true;
  }
  assert.ok(threw, label);
}

// เรียก RPC ที่คาดว่าจะ raise ภายใน savepoint — tx ยัง alive assert ต่อได้
async function expectThrow(
  c: Client,
  sql: string,
  params: unknown[],
  label: string,
) {
  let threw = false;
  await c.query("savepoint sp");
  try {
    await c.query(sql, params);
  } catch {
    threw = true;
  }
  if (threw) await c.query("rollback to savepoint sp");
  else await c.query("release savepoint sp");
  assert.ok(threw, label);
}

// ---- P1-10: checkout ด้วย customer ข้าม org ต้อง reject ----
test("checkout_sale ปฏิเสธ _customer_id ที่เป็นของ org อื่น", { skip }, async () => {
  await withTx(async (c) => {
    const a = await seedShop(c, "ร้าน A");
    const b = await seedShop(c, "ร้าน B");
    // org A ขายแล้วอ้าง customer ของ org B → reject (cross-tenant PII/debt)
    await mustThrow(
      c.query(CHECKOUT, [
        a.orgId,
        JSON.stringify([{ product_id: a.productId, qty: 1 }]),
        "cash", 0, 1000, null, b.customerId, a.branchA,
      ]),
      "customer ข้าม org ต้องถูกปฏิเสธ",
    );
  });
});

test("checkout_sale รับ customer ของ org ตัวเองได้ตามปกติ", { skip }, async () => {
  await withTx(async (c) => {
    const a = await seedShop(c);
    const res = await c.query(CHECKOUT, [
      a.orgId,
      JSON.stringify([{ product_id: a.productId, qty: 2 }]),
      "cash", 0, 1000, null, a.customerId, a.branchA,
    ]);
    assert.equal(Number(res.rows[0].r.total), 200);
    assert.equal(Number(res.rows[0].r.points), 2, "ต้องได้แต้ม floor(200/100)=2");
  });
});

// ---- P1-7: receive_transfer เรียกซ้ำ สต็อกต้องไม่เบิ้ล ----
test("receive_transfer เรียกซ้ำ — สต็อกปลายทางต้องไม่เบิ้ล", { skip }, async () => {
  await withTx(async (c) => {
    const s = await seedShop(c);
    const t = await c.query("select create_transfer($1,$2,$3,$4::jsonb,$5,$6) as r", [
      s.orgId, s.branchA, s.branchB,
      JSON.stringify([{ product_id: s.productId, name: "สินค้าทดสอบ", qty: 10 }]),
      null, null,
    ]);
    const transferId = t.rows[0].r;

    const destStock = async () =>
      Number(
        (
          await c.query(
            "select coalesce(qty,0) q from product_stock where product_id=$1 and branch_id=$2",
            [s.productId, s.branchB],
          )
        ).rows[0]?.q ?? 0,
      );

    await c.query("select receive_transfer($1,$2)", [transferId, null]);
    const after = await destStock();
    assert.equal(after, 10, "รับโอนครั้งแรกปลายทาง +10");

    // เรียกซ้ำ → ต้อง raise และสต็อกไม่เพิ่ม
    await expectThrow(
      c, "select receive_transfer($1,$2)", [transferId, null],
      "receive_transfer ซ้ำต้องถูกปฏิเสธ",
    );
    assert.equal(await destStock(), 10, "สต็อกปลายทางต้องไม่เบิ้ล");
  });
});

test("cancel_transfer เรียกซ้ำ — สต็อกต้นทางต้องไม่เบิ้ล", { skip }, async () => {
  await withTx(async (c) => {
    const s = await seedShop(c);
    const t = await c.query("select create_transfer($1,$2,$3,$4::jsonb,$5,$6) as r", [
      s.orgId, s.branchA, s.branchB,
      JSON.stringify([{ product_id: s.productId, name: "สินค้าทดสอบ", qty: 10 }]),
      null, null,
    ]);
    const transferId = t.rows[0].r;

    const srcStock = async () =>
      Number(
        (
          await c.query(
            "select coalesce(qty,0) q from product_stock where product_id=$1 and branch_id=$2",
            [s.productId, s.branchA],
          )
        ).rows[0]?.q ?? 0,
      );
    // create ตัดต้นทางไปแล้ว 90
    assert.equal(await srcStock(), 90);
    await c.query("select cancel_transfer($1,$2)", [transferId, null]);
    assert.equal(await srcStock(), 100, "ยกเลิกคืนของกลับต้นทาง 100");

    await expectThrow(
      c, "select cancel_transfer($1,$2)", [transferId, null],
      "cancel_transfer ซ้ำต้องถูกปฏิเสธ",
    );
    assert.equal(await srcStock(), 100, "สต็อกต้นทางต้องไม่เบิ้ล");
  });
});

test("receive_transfer หลัง cancel แล้วต้องทำไม่ได้ (กันสร้างสต็อกจากอากาศ)", { skip }, async () => {
  await withTx(async (c) => {
    const s = await seedShop(c);
    const t = await c.query("select create_transfer($1,$2,$3,$4::jsonb,$5,$6) as r", [
      s.orgId, s.branchA, s.branchB,
      JSON.stringify([{ product_id: s.productId, name: "สินค้าทดสอบ", qty: 10 }]),
      null, null,
    ]);
    const transferId = t.rows[0].r;
    await c.query("select cancel_transfer($1,$2)", [transferId, null]);
    await expectThrow(
      c, "select receive_transfer($1,$2)", [transferId, null],
      "receive หลัง cancel ต้องถูกปฏิเสธ",
    );
    const destStock = Number(
      (
        await c.query(
          "select coalesce(qty,0) q from product_stock where product_id=$1 and branch_id=$2",
          [s.productId, s.branchB],
        )
      ).rows[0]?.q ?? 0,
    );
    assert.equal(destStock, 0, "ปลายทางต้องไม่มีสต็อกงอก");
  });
});

// ---- P1-8: คืนบิลเครดิต หนี้ต้องลด + แต้มถูกดึงคืน ----
test("process_return บิลเครดิต — ลดหนี้ตามยอดคืน และดึงแต้มคืน", { skip }, async () => {
  await withTx(async (c) => {
    const s = await seedShop(c);
    // ขายเชื่อ ฿1000 (10 ชิ้น × 100) → debt 1000, points 10
    const sale = await c.query(CHECKOUT, [
      s.orgId,
      JSON.stringify([{ product_id: s.productId, qty: 10 }]),
      "credit", 0, null, null, s.customerId, s.branchA,
    ]);
    const saleId = sale.rows[0].r.sale_id;
    assert.equal(Number(sale.rows[0].r.points), 10);

    const debt = async () =>
      (
        await c.query(
          "select amount::numeric a, paid::numeric p, status from debts where org_id=$1 and customer_id=$2",
          [s.orgId, s.customerId],
        )
      ).rows[0];
    const points = async () =>
      Number(
        (await c.query("select points from customers where id=$1", [s.customerId]))
          .rows[0].points,
      );

    let d = await debt();
    assert.equal(Number(d.a), 1000, "หนี้เริ่มต้น 1000");
    assert.equal(await points(), 10);

    // คืน 4 ชิ้น = ฿400
    await c.query(RETURN, [
      s.orgId, saleId,
      JSON.stringify([{ product_id: s.productId, qty: 4 }]),
      "ชำรุด", null, s.branchA,
    ]);
    d = await debt();
    assert.equal(Number(d.a) - Number(d.p), 600, "หนี้คงเหลือต้องลดเป็น 600");
    assert.equal(await points(), 6, "แต้มต้องถูกดึงคืน floor(400/100)=4 → เหลือ 6");
  });
});

test("process_return บิลเครดิต — คืนทั้งบิลไม่ทำให้หนี้/แต้มติดลบ", { skip }, async () => {
  await withTx(async (c) => {
    const s = await seedShop(c);
    const sale = await c.query(CHECKOUT, [
      s.orgId,
      JSON.stringify([{ product_id: s.productId, qty: 5 }]),
      "credit", 0, null, null, s.customerId, s.branchA,
    ]);
    const saleId = sale.rows[0].r.sale_id;

    await c.query(RETURN, [
      s.orgId, saleId,
      JSON.stringify([{ product_id: s.productId, qty: 5 }]),
      null, null, s.branchA,
    ]);
    const d = (
      await c.query(
        "select amount::numeric a, paid::numeric p, status from debts where org_id=$1 and customer_id=$2",
        [s.orgId, s.customerId],
      )
    ).rows[0];
    assert.ok(Number(d.a) - Number(d.p) <= 0.001, "หนี้คงเหลือต้องเป็น 0");
    assert.equal(d.status, "paid", "หนี้ที่คืนหมดต้องเป็น paid");
    const pts = Number(
      (await c.query("select points from customers where id=$1", [s.customerId])).rows[0].points,
    );
    assert.ok(pts >= 0, "แต้มต้องไม่ติดลบ");
  });
});

test("process_return บิลเงินสด — ไม่ยุ่งกับหนี้ (ไม่มี debt ให้แตะ)", { skip }, async () => {
  await withTx(async (c) => {
    const s = await seedShop(c);
    const sale = await c.query(CHECKOUT, [
      s.orgId,
      JSON.stringify([{ product_id: s.productId, qty: 3 }]),
      "cash", 0, 1000, null, s.customerId, s.branchA,
    ]);
    await c.query(RETURN, [
      s.orgId, sale.rows[0].r.sale_id,
      JSON.stringify([{ product_id: s.productId, qty: 1 }]),
      null, null, s.branchA,
    ]);
    const debtCount = Number(
      (
        await c.query("select count(*) n from debts where org_id=$1", [s.orgId])
      ).rows[0].n,
    );
    assert.equal(debtCount, 0, "บิลเงินสดต้องไม่มี debt row");
    // แต้มจากเงินสด: ขาย 3×100=300 → 3 แต้ม, คืน 1×100 → -1 → เหลือ 2
    const pts = Number(
      (await c.query("select points from customers where id=$1", [s.customerId])).rows[0].points,
    );
    assert.equal(pts, 2, "แต้มเงินสดก็ถูกดึงคืนตามสัดส่วน (3-1=2)");
  });
});
