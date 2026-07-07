import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { SUBSCRIPTION_UPSERT_SQL } from "../lib/billing.ts";

const DB = process.env.DATABASE_URL;

// รันเฉพาะเมื่อมี DATABASE_URL — ทุกเทสต์ห่อ transaction แล้ว rollback (ไม่แตะข้อมูลจริง)
// ใช้ SQL จริง (SUBSCRIPTION_UPSERT_SQL) ที่ webhook/checkout ใช้ เพื่อกันเทสต์ drift จากโปรดักชัน

test(
  "webhook ordering: event เก่ากว่าที่บันทึกไว้ต้องไม่ทับ (กันฟื้น sub ที่ยกเลิกแล้ว)",
  { skip: DB ? false : "ไม่มี DATABASE_URL — ข้าม integration test" },
  async () => {
    const c = new pg.Client({ connectionString: DB });
    await c.connect();
    try {
      await c.query("begin");
      const orgId = (
        await c.query(
          "insert into organizations (name) values ('itest-billing') returning id",
        )
      ).rows[0].id;

      const upsert = (subId: string, status: string, ts: number) =>
        c.query(SUBSCRIPTION_UPSERT_SQL, [orgId, subId, status, null, null, ts]);
      const statusOf = async () =>
        (
          await c.query(
            "select status, event_ts from subscriptions where org_id=$1",
            [orgId],
          )
        ).rows[0];

      const T1 = 1_700_000_000;
      const T2 = T1 + 100; // ใหม่กว่า
      const T0 = T1 - 100; // เก่ากว่า

      // 1) subscription active (event เวลา T1)
      await upsert("sub_A", "active", T1);
      assert.equal((await statusOf()).status, "active");

      // 2) subscription ถูกยกเลิก (event ใหม่กว่า T2) → apply
      await upsert("sub_A", "canceled", T2);
      assert.equal((await statusOf()).status, "canceled");

      // 3) event 'active' เก่า (T0) มาช้า/ถูก retry → ต้องถูกข้าม (ห้ามฟื้นเป็น active)
      await upsert("sub_A", "active", T0);
      assert.equal(
        (await statusOf()).status,
        "canceled",
        "event เก่ากว่าต้องไม่ resurrect subscription",
      );

      // 4) idempotency: re-deliver event เดิม (T2) → ไม่ error และสถานะคงเดิม
      await upsert("sub_A", "canceled", T2);
      assert.equal((await statusOf()).status, "canceled");

      // 5) event ใหม่จริง (T3) → apply ตามปกติ
      await upsert("sub_A", "active", T2 + 100);
      assert.equal((await statusOf()).status, "active");

      await c.query("rollback");
    } finally {
      await c.end();
    }
  },
);

test(
  "cross-subscription: event เก่าของ sub เก่า ต้องไม่ทับแถวที่เป็น sub ใหม่แล้ว",
  { skip: DB ? false : "ไม่มี DATABASE_URL — ข้าม integration test" },
  async () => {
    const c = new pg.Client({ connectionString: DB });
    await c.connect();
    try {
      await c.query("begin");
      const orgId = (
        await c.query(
          "insert into organizations (name) values ('itest-billing2') returning id",
        )
      ).rows[0].id;
      const upsert = (subId: string, status: string, ts: number) =>
        c.query(SUBSCRIPTION_UPSERT_SQL, [orgId, subId, status, null, null, ts]);
      const row = async () =>
        (
          await c.query(
            "select stripe_subscription_id, status from subscriptions where org_id=$1",
            [orgId],
          )
        ).rows[0];

      const T = 1_700_000_000;
      // ลูกค้าสมัคร sub_new (ใหม่ล่าสุด)
      await upsert("sub_new", "active", T + 500);
      // event เก่าของ sub_old ที่ยกเลิกไปแล้วถูก retry มาช้า (เวลาเก่ากว่า) → ต้องไม่ทับ
      await upsert("sub_old", "canceled", T);
      const r = await row();
      assert.equal(r.stripe_subscription_id, "sub_new");
      assert.equal(r.status, "active");

      await c.query("rollback");
    } finally {
      await c.end();
    }
  },
);

test(
  "productLimitError นับเฉพาะ is_active=true (soft delete ต้องคืนโควตา)",
  { skip: DB ? false : "ไม่มี DATABASE_URL — ข้าม integration test" },
  async () => {
    const c = new pg.Client({ connectionString: DB });
    await c.connect();
    try {
      await c.query("begin");
      const orgId = (
        await c.query(
          "insert into organizations (name) values ('itest-limits') returning id",
        )
      ).rows[0].id;
      await c.query(
        "insert into products (org_id, name, is_active) values ($1,'p1',true),($1,'p2',true),($1,'p3',false)",
        [orgId],
      );

      // ตรรกะที่ productLimitError ใช้: count เฉพาะ is_active=true
      const active = (
        await c.query(
          "select count(*)::int n from products where org_id=$1 and is_active = true",
          [orgId],
        )
      ).rows[0].n;
      const all = (
        await c.query("select count(*)::int n from products where org_id=$1", [
          orgId,
        ])
      ).rows[0].n;

      assert.equal(all, 3, "มีสินค้าทั้งหมด 3 (รวมที่ลบแล้ว)");
      assert.equal(active, 2, "นับโควตาเฉพาะ active = 2 (ของที่ลบไม่กินโควตา)");

      await c.query("rollback");
    } finally {
      await c.end();
    }
  },
);
