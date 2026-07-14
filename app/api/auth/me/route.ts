import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";

// สถานะล็อกอินแบบเบา — ให้ CTA บน landing/pricing (static) ถามทีหลังฝั่ง client
// จะได้ไม่ต้องอ่าน cookie ใน page เอง (P2-24: ไม่งั้นทั้งหน้าโดนบังคับ dynamic)
export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json(
    { authed: !!user },
    { headers: { "Cache-Control": "no-store" } },
  );
}
