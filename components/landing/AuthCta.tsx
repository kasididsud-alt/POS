"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

/**
 * CTA ที่รู้สถานะล็อกอิน — หน้า landing/pricing เป็น static ได้เพราะไม่อ่าน cookie เอง
 * เริ่มจากหน้าตาแบบ "ยังไม่ล็อกอิน" (ตรงกับที่ prerender) แล้วค่อยถาม /api/auth/me หลัง mount
 */
function useIsAuthed(): boolean {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAuthed(!!d?.authed))
      .catch(() => {
        // เน็ตพัง/ยังไม่พร้อม — คงหน้าตา logged-out ซึ่งใช้งานต่อได้เสมอ
      });
  }, []);
  return authed;
}

/** ปุ่มคู่บน nav: ยังไม่ล็อกอิน = เข้าสู่ระบบ + เริ่มฟรี / ล็อกอินแล้ว = เข้าระบบจัดการ */
export function AuthNavCta({
  loginClass,
  ctaClass,
}: Readonly<{ loginClass: string; ctaClass: string }>) {
  const authed = useIsAuthed();
  if (authed)
    return (
      <Link href="/dashboard" className={ctaClass}>
        เข้าระบบจัดการ
      </Link>
    );
  return (
    <>
      <Link href="/login" className={loginClass}>
        เข้าสู่ระบบ
      </Link>
      <Link href="/signup" className={ctaClass}>
        เริ่มฟรี
      </Link>
    </>
  );
}

/** ปุ่มหลักในเนื้อหา: /signup "เริ่มใช้ฟรี" ↔ /dashboard "ไปที่แดชบอร์ด" (+ ปุ่มเข้าสู่ระบบเสริมถ้าให้ ghostClass) */
export function AuthPrimaryCta({
  className,
  ghostClass,
  children,
}: Readonly<{ className: string; ghostClass?: string; children?: ReactNode }>) {
  const authed = useIsAuthed();
  return (
    <>
      <Link href={authed ? "/dashboard" : "/signup"} className={className}>
        {authed ? "ไปที่แดชบอร์ด" : "เริ่มใช้ฟรี"}
        {children}
      </Link>
      {!authed && ghostClass && (
        <Link href="/login" className={ghostClass}>
          เข้าสู่ระบบ
        </Link>
      )}
    </>
  );
}
