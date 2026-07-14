import { NextRequest, NextResponse } from "next/server";
import { one } from "@/lib/db";
import { getAppContext } from "@/lib/auth";

// จอลูกค้า poll อ่านสถานะล่าสุดของ session ตัวเอง (ต้อง login org เดียวกัน)
// ส่ง ?v=<เวอร์ชันล่าสุดที่มี> มาด้วย — ถ้าไม่มีอะไรเปลี่ยนตอบ same:true (ไม่ต้องส่ง QR ซ้ำ)
export async function GET(req: NextRequest) {
  const ctx = await getAppContext();
  if (!ctx?.org) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  const v = req.nextUrl.searchParams.get("v");
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });
  }

  const row = await one<{ state: unknown; paired: boolean; v: string }>(
    `select state, paired, floor(extract(epoch from updated_at) * 1000)::bigint::text as v
       from customer_displays
      where id = $1::uuid and org_id = $2`,
    [id, ctx.org.id],
  ).catch(() => null); // id ไม่ใช่ uuid → ถือว่าไม่พบ

  if (!row) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  if (v && v === row.v) {
    return NextResponse.json({ ok: true, same: true, v: row.v, paired: row.paired });
  }
  return NextResponse.json({ ok: true, state: row.state, paired: row.paired, v: row.v });
}
