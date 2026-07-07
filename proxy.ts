import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

// เพดานคำขอต่อเซสชันต่อนาที — abuse/DoS backstop
// ตั้งไว้ที่เพดานแพ็กสูงสุด (Premium) เพื่อไม่รบกวนการใช้งานจริง (สแกนบาร์โค้ดยิงถี่ได้)
const REQ_PER_MIN = 2000;

// หน้าสาธารณะ — นอกจากนี้ต้องล็อกอินทั้งหมด
const PUBLIC_PATHS = [
  "/",
  "/pricing",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/terms",
  "/privacy",
  "/robots.txt",
  "/sitemap.xml",
  "/opengraph-image",
  "/manifest.webmanifest",
  "/icon",
  "/apple-icon",
];

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic =
    PUBLIC_PATHS.includes(path) ||
    path.startsWith("/api/") ||
    path.startsWith("/opengraph-image"); // เผื่อ Next เพิ่ม suffix
  const hasSession = !!request.cookies.get("session")?.value;

  if (!isPublic && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Rate-limit ผู้ใช้ที่ล็อกอินแล้ว (abuse backstop)
  if (!isPublic && hasSession) {
    const token = request.cookies.get("session")!.value;
    const rl = rateLimit(`req:${token}`, REQ_PER_MIN);
    if (!rl.ok) {
      return new NextResponse("คำขอถี่เกินไป กรุณาลองใหม่อีกครั้งในอีกสักครู่", {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000)),
          ),
        },
      });
    }
  }

  // ส่ง pathname ต่อให้ server component (layout) อ่านไปเช็คสิทธิ์ตามแพ็ก
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", path);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
