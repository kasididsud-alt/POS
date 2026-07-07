import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

const DB = process.env.DATABASE_URL;
const skip = DB ? false : "ไม่มี DATABASE_URL — ข้าม integration test";

// Hardening checkout_sale / process_return (db/modules/23_checkout_hardening.sql)
// ทุกเทสต์ห่อใน transaction แล้ว rollback → ไม่แตะข้อมูลจริง
// seed ข้อมูลเองทั้งหมด (org/branch/product/stock) — ไม่พึ่งข้อมูลเดิมใน DB

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

async function seedShop(c: Client, name = "ร้านทดสอบ hardening") {
  const one = async (sql: string, p: unknown[] = []) =>
    (await c.query(sql, p)).rows[0];
  const org = await one(
    "insert into organizations (name) values ($1) returning id",
    [name],
  );
  const branch = await one(
    "insert into branches (org_id, name, type, is_default) values ($1,'สาขาหลัก','shop',true) returning id",
    [org.id],
  );
  const product = await one(
    "insert into products (org_id, name, price, cost) values ($1,'น้ำปลาทดสอบ',100,60) returning id",
    [org.id],
  );
  await c.query(
    "insert into stock_movements (org_id, product_id, branch_id, qty_change, reason) values ($1,$2,$3,50,'adjust')",
    [org.id, product.id, branch.id],
  );
  return { orgId: org.id as string, branchId: branch.id as string, productId: product.id as string };
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

test("checkout_sale ใช้ราคาจาก DB — ราคาที่ client ส่งมาไม่มีผล", { skip }, async () => {
  await withTx(async (c) => {
    const { orgId, branchId, productId } = await seedShop(c);
    // client แอบส่ง unit_price: 1 มาด้วย — ต้องถูกเมิน ราคาจริง 100
    const res = await c.query(CHECKOUT, [
      orgId,
      JSON.stringify([{ product_id: productId, name: "hacked", unit_price: 1, qty: 2 }]),
      "cash", 0, 1000, null, null, branchId,
    ]);
    assert.equal(Number(res.rows[0].r.total), 200, "ยอดต้องคิดจากราคา DB (100×2)");

    const item = (
      await c.query(
        "select unit_price::numeric un, name_snapshot, line_total::numeric lt from sale_items where sale_id = $1",
        [res.rows[0].r.sale_id],
      )
    ).rows[0];
    assert.equal(Number(item.un), 100, "unit_price ใน sale_items ต้องมาจาก DB");
    assert.equal(Number(item.lt), 200);
    assert.equal(item.name_snapshot, "น้ำปลาทดสอบ", "ชื่อ snapshot ต้องมาจาก DB ไม่ใช่ client");
  });
});

test("checkout_sale ปฏิเสธ qty = 0 / ติดลบ / ไม่ใช่จำนวนเต็ม", { skip }, async () => {
  await withTx(async (c) => {
    let s = await seedShop(c);
    for (const qty of [0, -1, 1.5]) {
      await mustThrow(
        c.query(CHECKOUT, [
          s.orgId,
          JSON.stringify([{ product_id: s.productId, qty }]),
          "cash", 0, 1000, null, null, s.branchId,
        ]),
        `qty=${qty} ต้องถูกปฏิเสธ`,
      );
      await c.query("rollback"); await c.query("begin"); // reset aborted tx
      s = await seedShop(c);
    }
  });
});

test("checkout_sale จำกัดเพดานส่วนลดไม่เกินยอดรวม และปฏิเสธส่วนลดติดลบ", { skip }, async () => {
  await withTx(async (c) => {
    let s = await seedShop(c);
    // ส่วนลดปกติ 50 จากยอด 200 → 150
    const ok = await c.query(CHECKOUT, [
      s.orgId,
      JSON.stringify([{ product_id: s.productId, qty: 2 }]),
      "cash", 50, 1000, null, null, s.branchId,
    ]);
    assert.equal(Number(ok.rows[0].r.total), 150);

    // ส่วนลด 300 เกินยอด 200 → ปฏิเสธ
    await mustThrow(
      c.query(CHECKOUT, [
        s.orgId,
        JSON.stringify([{ product_id: s.productId, qty: 2 }]),
        "cash", 300, 1000, null, null, s.branchId,
      ]),
      "ส่วนลดเกินยอดรวมต้องถูกปฏิเสธ",
    );
    await c.query("rollback"); await c.query("begin");
    s = await seedShop(c);

    // ส่วนลดติดลบ → ปฏิเสธ (กันบวกยอดกลับ)
    await mustThrow(
      c.query(CHECKOUT, [
        s.orgId,
        JSON.stringify([{ product_id: s.productId, qty: 1 }]),
        "cash", -50, 1000, null, null, s.branchId,
      ]),
      "ส่วนลดติดลบต้องถูกปฏิเสธ",
    );
  });
});

test("checkout_sale ปฏิเสธ product/branch ที่ไม่ใช่ของ org ผู้เรียก", { skip }, async () => {
  await withTx(async (c) => {
    const shopA = await seedShop(c, "ร้าน A");
    const shopB = await seedShop(c, "ร้าน B");

    // org A ขายสินค้าของ org B → ปฏิเสธ
    await mustThrow(
      c.query(CHECKOUT, [
        shopA.orgId,
        JSON.stringify([{ product_id: shopB.productId, qty: 1 }]),
        "cash", 0, 1000, null, null, shopA.branchId,
      ]),
      "ขายสินค้าข้าม org ต้องถูกปฏิเสธ",
    );
    await c.query("rollback"); await c.query("begin");

    const a2 = await seedShop(c, "ร้าน A2");
    const b2 = await seedShop(c, "ร้าน B2");
    // org A ใช้ branch ของ org B → ปฏิเสธ
    await mustThrow(
      c.query(CHECKOUT, [
        a2.orgId,
        JSON.stringify([{ product_id: a2.productId, qty: 1 }]),
        "cash", 0, 1000, null, null, b2.branchId,
      ]),
      "ใช้ branch ข้าม org ต้องถูกปฏิเสธ",
    );
  });
});

test("checkout_sale ยังกันขายเกินสต็อก (รวมกรณีสินค้าเดิมหลายบรรทัด)", { skip }, async () => {
  await withTx(async (c) => {
    const s = await seedShop(c); // สต็อก 50
    await mustThrow(
      c.query(CHECKOUT, [
        s.orgId,
        JSON.stringify([
          { product_id: s.productId, qty: 30 },
          { product_id: s.productId, qty: 30 },
        ]),
        "cash", 0, 10000, null, null, s.branchId,
      ]),
      "ยอดรวมต่อสินค้า 60 > สต็อก 50 ต้องถูกปฏิเสธ",
    );
  });
});

test("process_return คืนปกติได้ ยอดคืนคิดจากราคาขายจริง และสต็อกกลับเข้าสาขา", { skip }, async () => {
  await withTx(async (c) => {
    const s = await seedShop(c);
    const sale = await c.query(CHECKOUT, [
      s.orgId,
      JSON.stringify([{ product_id: s.productId, qty: 3 }]),
      "cash", 0, 1000, null, null, s.branchId,
    ]);
    const saleId = sale.rows[0].r.sale_id;

    const stock = async () =>
      Number(
        (
          await c.query(
            "select coalesce(qty,0) q from product_stock where product_id=$1 and branch_id=$2",
            [s.productId, s.branchId],
          )
        ).rows[0]?.q ?? 0,
      );
    const before = await stock(); // 47

    // client แอบส่ง unit_price 999 — ยอดคืนต้องเป็น 100×2 = 200
    const ret = await c.query(RETURN, [
      s.orgId, saleId,
      JSON.stringify([{ product_id: s.productId, unit_price: 999, qty: 2 }]),
      "ชำรุด", null, s.branchId,
    ]);
    const refund = (
      await c.query("select total_refund::numeric t from sale_returns where id=$1", [ret.rows[0].r])
    ).rows[0];
    assert.equal(Number(refund.t), 200, "ยอดคืนต้องคิดจากราคาขายจริงใน sale_items");
    assert.equal(await stock(), before + 2, "สต็อกต้องกลับเข้าสาขา +2");
  });
});

test("process_return กันคืนเกินจำนวนขาย (สะสมข้ามหลายรอบ)", { skip }, async () => {
  await withTx(async (c) => {
    const s = await seedShop(c);
    const sale = await c.query(CHECKOUT, [
      s.orgId,
      JSON.stringify([{ product_id: s.productId, qty: 3 }]),
      "cash", 0, 1000, null, null, s.branchId,
    ]);
    const saleId = sale.rows[0].r.sale_id;

    // รอบแรกคืน 2 — ผ่าน
    await c.query(RETURN, [
      s.orgId, saleId,
      JSON.stringify([{ product_id: s.productId, qty: 2 }]),
      null, null, s.branchId,
    ]);
    // รอบสองคืนอีก 2 → สะสม 4 > ขาย 3 → ปฏิเสธ
    await mustThrow(
      c.query(RETURN, [
        s.orgId, saleId,
        JSON.stringify([{ product_id: s.productId, qty: 2 }]),
        null, null, s.branchId,
      ]),
      "คืนสะสมเกินจำนวนขายต้องถูกปฏิเสธ",
    );
  });
});

test("process_return ปฏิเสธ qty คืน ≤ 0 และ sale ข้าม org", { skip }, async () => {
  await withTx(async (c) => {
    let a = await seedShop(c, "ร้าน A");
    let sale = await c.query(CHECKOUT, [
      a.orgId,
      JSON.stringify([{ product_id: a.productId, qty: 2 }]),
      "cash", 0, 1000, null, null, a.branchId,
    ]);
    for (const qty of [0, -1]) {
      await mustThrow(
        c.query(RETURN, [
          a.orgId, sale.rows[0].r.sale_id,
          JSON.stringify([{ product_id: a.productId, qty }]),
          null, null, a.branchId,
        ]),
        `qty คืน=${qty} ต้องถูกปฏิเสธ`,
      );
      await c.query("rollback"); await c.query("begin");
      a = await seedShop(c, "ร้าน A");
      sale = await c.query(CHECKOUT, [
        a.orgId,
        JSON.stringify([{ product_id: a.productId, qty: 2 }]),
        "cash", 0, 1000, null, null, a.branchId,
      ]);
    }

    // org B พยายามคืนบิลของ org A → ปฏิเสธ
    const b = await seedShop(c, "ร้าน B");
    await mustThrow(
      c.query(RETURN, [
        b.orgId, sale.rows[0].r.sale_id,
        JSON.stringify([{ product_id: a.productId, qty: 1 }]),
        null, null, b.branchId,
      ]),
      "คืนบิลข้าม org ต้องถูกปฏิเสธ",
    );
  });
});

test("process_return ปฏิเสธสินค้าที่ไม่อยู่ในบิล", { skip }, async () => {
  await withTx(async (c) => {
    const s = await seedShop(c);
    const other = (
      await c.query(
        "insert into products (org_id, name, price) values ($1,'สินค้าอื่น',50) returning id",
        [s.orgId],
      )
    ).rows[0];
    const sale = await c.query(CHECKOUT, [
      s.orgId,
      JSON.stringify([{ product_id: s.productId, qty: 1 }]),
      "cash", 0, 1000, null, null, s.branchId,
    ]);
    await mustThrow(
      c.query(RETURN, [
        s.orgId, sale.rows[0].r.sale_id,
        JSON.stringify([{ product_id: other.id, qty: 1 }]),
        null, null, s.branchId,
      ]),
      "คืนสินค้าที่ไม่ได้ขายในบิลต้องถูกปฏิเสธ",
    );
  });
});
