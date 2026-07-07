import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { one, query } from "@/lib/db";
import { createSession } from "@/lib/session";
import { getProfileFromCode } from "@/lib/oauth";

// GET /api/auth/google/callback?code=...&state=...
// Google เด้งกลับมาที่นี่: ตรวจ state → ดึงโปรไฟล์ → หา/ผูก/สร้างผู้ใช้ → เปิด session
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const c = await cookies();
  const savedState = c.get("g_state")?.value;
  const next = c.get("g_next")?.value ?? "/dashboard";
  // ใช้ครั้งเดียวแล้วทิ้ง
  c.delete("g_state");
  c.delete("g_next");

  const fail = (msg: string) => {
    const u = new URL("/login", request.url);
    u.searchParams.set("error", msg);
    return NextResponse.redirect(u);
  };

  if (oauthError) return fail("ยกเลิกการเข้าสู่ระบบด้วย Google");
  if (!code || !state || !savedState || state !== savedState) {
    return fail("เซสชันล็อกอิน Google ไม่ถูกต้อง ลองใหม่อีกครั้ง");
  }

  let profile;
  try {
    profile = await getProfileFromCode(code);
  } catch {
    return fail("เชื่อมต่อ Google ไม่สำเร็จ ลองใหม่อีกครั้ง");
  }

  if (!profile.email || !profile.email_verified) {
    return fail("อีเมล Google ยังไม่ได้รับการยืนยัน");
  }

  // 1) เคยผูกบัญชี Google ไว้แล้ว
  let user = await one<{ id: string }>(
    "select id from users where google_sub = $1",
    [profile.sub],
  );

  // 2) มีบัญชีอีเมลเดิม (สมัครด้วยรหัสผ่าน) → ผูก Google เข้ากับบัญชีนั้น
  if (!user) {
    const byEmail = await one<{ id: string }>(
      "select id from users where email = $1",
      [profile.email],
    );
    if (byEmail) {
      await query(
        `update users set google_sub = $1,
           avatar_url = coalesce(avatar_url, $2),
           full_name = coalesce(full_name, $3)
         where id = $4`,
        [profile.sub, profile.picture, profile.name, byEmail.id],
      );
      user = byEmail;
    }
  }

  // 3) ผู้ใช้ใหม่ → สร้างบัญชี (ไม่มีรหัสผ่าน) แล้วไปตั้งชื่อร้านที่ /onboarding
  if (!user) {
    user = await one<{ id: string }>(
      `insert into users (email, full_name, google_sub, avatar_url)
       values ($1, $2, $3, $4) returning id`,
      [profile.email, profile.name, profile.sub, profile.picture],
    );
  }

  if (!user) return fail("สร้างบัญชีไม่สำเร็จ ลองใหม่อีกครั้ง");

  // ล้างประวัติล็อกอินผิด (เผื่อเคยพลาดด้วยรหัสผ่าน) แล้วเปิด session
  await query("delete from login_attempts where email = $1", [profile.email]);
  await createSession(user.id);

  // ผู้ใช้ครั้งแรกยังไม่มีร้าน → พาไปตั้งชื่อร้านที่ /onboarding ก่อน
  // (ไม่ต้องรอ guard ของ /dashboard เด้ง — ลดการ redirect ซ้อน)
  const membership = await one<{ id: string }>(
    "select id from memberships where user_id = $1 limit 1",
    [user.id],
  );
  const dest = membership ? next : "/onboarding";
  return NextResponse.redirect(new URL(dest, request.url));
}
