import { redirect } from "next/navigation";
import { getAppContext, type AppContext } from "@/lib/auth";
import type { Organization } from "@/lib/types";

/** context ที่การันตีว่ามีร้านแล้ว (org ไม่เป็น null) */
export type OrgContext = AppContext & { org: Organization };

/** ใช้ในหน้าทั่วไป: ต้องล็อกอิน + มีร้าน */
export async function requirePage(): Promise<OrgContext> {
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");
  if (!ctx.org) redirect("/onboarding");
  return ctx as OrgContext;
}

/** ใช้ในหน้าที่เฉพาะเจ้าของร้าน — พนักงานจะถูกเด้งกลับ dashboard */
export async function requireOwnerPage(): Promise<OrgContext> {
  const ctx = await requirePage();
  if (ctx.membership?.role !== "owner") {
    redirect("/dashboard?denied=1");
  }
  return ctx;
}
