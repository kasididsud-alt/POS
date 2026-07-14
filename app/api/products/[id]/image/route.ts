import { NextRequest, NextResponse } from "next/server";
import { one } from "@/lib/db";
import { getAppContext } from "@/lib/auth";

// เสิร์ฟรูปสินค้าเป็นไบนารี (แปลงจาก data URL ใน DB) — แยกจาก list query
// เพื่อให้หน้า POS/รายการสินค้าโหลดเบา และเบราว์เซอร์ cache รูปได้ (ETag จาก updated_at)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAppContext();
  if (!ctx?.org) return new Response("unauthorized", { status: 401 });

  const { id } = await params;
  const row = await one<{ image_url: string | null; updated_at: string }>(
    "select image_url, updated_at from products where id = $1::uuid and org_id = $2",
    [id, ctx.org.id],
  ).catch(() => null); // id ไม่ใช่ uuid → ถือว่าไม่พบ
  if (!row?.image_url) return new Response("not found", { status: 404 });

  const etag = `"${Buffer.from(row.updated_at).toString("base64url")}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const m = row.image_url.match(/^data:(image\/[a-z+]+);base64,([\s\S]+)$/);
  if (!m) return new Response("invalid image", { status: 500 });

  return new NextResponse(Buffer.from(m[2], "base64"), {
    headers: {
      "Content-Type": m[1],
      // private: รูปอยู่หลัง auth ของร้าน — ให้เบราว์เซอร์ cache เอง ไม่ให้ CDN แชร์ข้ามคน
      "Cache-Control": "private, max-age=3600",
      ETag: etag,
    },
  });
}
