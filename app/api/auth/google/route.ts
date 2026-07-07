import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildAuthUrl, googleConfigured, newState } from "@/lib/oauth";

// GET /api/auth/google?next=/dashboard
// เริ่ม flow: ตั้ง state cookie กัน CSRF แล้วเด้งไปหน้ายินยอมของ Google
export async function GET(request: Request) {
  if (!googleConfigured()) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "ยังไม่ได้ตั้งค่า Google Sign-In");
    return NextResponse.redirect(url);
  }

  const next = new URL(request.url).searchParams.get("next") ?? "/dashboard";
  const state = newState();

  const c = await cookies();
  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 10, // 10 นาทีให้ล็อกอินเสร็จ
    secure: process.env.COOKIE_SECURE === "true",
  };
  c.set("g_state", state, cookieOpts);
  // เก็บปลายทางหลังล็อกอินไว้ (อย่าให้ผู้ใช้ใส่ค่าภายนอกได้)
  c.set("g_next", next.startsWith("/") ? next : "/dashboard", cookieOpts);

  return NextResponse.redirect(buildAuthUrl(state));
}
