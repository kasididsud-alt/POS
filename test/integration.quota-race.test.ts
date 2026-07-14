import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

const DB = process.env.DATABASE_URL;
const skip = DB ? false : "ไม่มี DATABASE_URL — ข้าม integration test";

// เทสต์กลไกกัน race โควตา (P2-6): pg_advisory_xact_lock + count + insert ในธุรกรรมเดียว
// — pattern เดียวกับ saveProduct/inviteUserToOrg. สอง connection ยิงพร้อมกันที่เพดาน
// เหลือ 1 ช่อง ต้อง insert สำเร็จแค่ตัวเดียว (ตัวหลังถูก serialize แล้วเห็น count เต็ม)
test("advisory lock กันเพิ่มสินค้าทะลุโควตาตอน concurrent", { skip }, async () => {
  const a = new pg.Client({ connectionString: DB });
  const b = new pg.Client({ connectionString: DB });
  await a.connect();
  await b.connect();

  // fixture นอกธุรกรรมเทสต์ (advisory lock ต้องข้าม connection ได้ เลย rollback แบบ
  // transaction เดียวไม่ได้) — ลบทิ้งเองตอนจบ
  const org = (
    await a.query("insert into organizations (name) values ('เทสต์ race โควตา') returning id")
  ).rows[0];
  const MAX = 2; // สมมติเพดานแพ็ก = 2 (ค่า PLANS จริงอยู่ฝั่งแอป — ที่นี่ทดสอบกลไก DB)
  await a.query("insert into products (org_id, name, price) values ($1,'ตัวที่1',10)", [
    org.id,
  ]);

  // ทั้งสองฝั่งทำเหมือน saveProduct: lock → count → insert ถ้ายังไม่เต็ม
  async function tryInsert(c: pg.Client, name: string): Promise<boolean> {
    await c.query("begin");
    try {
      await c.query("select pg_advisory_xact_lock(hashtext($1::text), 1)", [org.id]);
      const n = Number(
        (
          await c.query(
            "select count(*)::int as n from products where org_id=$1 and is_active=true",
            [org.id],
          )
        ).rows[0].n,
      );
      if (n >= MAX) {
        await c.query("rollback");
        return false;
      }
      // หน่วงระหว่างถือ lock — ถ้า lock ไม่ทำงาน อีกฝั่งจะ count ทัน (เห็น 1) แล้ว insert ซ้อน
      await c.query("select pg_sleep(0.15)");
      await c.query("insert into products (org_id, name, price) values ($1,$2,10)", [
        org.id,
        name,
      ]);
      await c.query("commit");
      return true;
    } catch (e) {
      await c.query("rollback").catch(() => {});
      throw e;
    }
  }

  try {
    const [ra, rb] = await Promise.all([tryInsert(a, "แข่ง-A"), tryInsert(b, "แข่ง-B")]);
    const finalCount = Number(
      (
        await a.query(
          "select count(*)::int as n from products where org_id=$1 and is_active=true",
          [org.id],
        )
      ).rows[0].n,
    );

    assert.equal(finalCount, MAX, `สินค้าต้องไม่เกินเพดาน ${MAX} (ได้ ${finalCount})`);
    assert.ok(ra !== rb, "ต้องสำเร็จแค่ฝั่งเดียว อีกฝั่งถูกปฏิเสธ");
  } finally {
    // เก็บกวาด fixture (cascade ลบ products ให้)
    await a.query("delete from organizations where id=$1", [org.id]);
    await a.end();
    await b.end();
  }
});
