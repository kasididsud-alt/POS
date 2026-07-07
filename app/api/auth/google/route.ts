import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildAuthUrl, googleConfigured, newState } from "@/lib/oauth";
import { safeInternalPath } from "@/lib/safe-redirect";

// GET /api/auth/google?next=/dashboard
// เริ่ม flow: ตั้ง state cookie กัน CSRF แล้วเด้งไปหน้ายินยอมของ Google
export async function GET(request: Request) {
  if (!googleConfigured()) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "ยังไม่ได้ตั้งค่า Google Sign-In");
    return NextResponse.redirect(url);
  }

  // sanitize `next` กัน open redirect (รวม protocol-relative "//evil.com" ที่
  // ผ่าน startsWith("/")) ก่อนเก็บลง cookie g_next ที่ callback ใช้ redirect
  const next = safeInternalPath(new URL(request.url).searchParams.get("next"));
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
  // เก็บปลายทางหลังล็อกอินไว้ (sanitize แล้ว — เป็น path ภายในเสมอ)
  c.set("g_next", next, cookieOpts);

  return NextResponse.redirect(buildAuthUrl(state));
}
