import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/auth";
import DisplayClient from "./DisplayClient";

export const metadata: Metadata = {
  title: "จอลูกค้า",
  robots: { index: false, follow: false },
};

// จอลูกค้า: เปิดบนแท็บเล็ต/จอที่สองที่ login ร้านเดียวกัน แล้วจับคู่กับเครื่องแคชเชียร์
// อยู่นอก (app) layout — ไม่มี sidebar/เมนู เพื่อให้แสดงเต็มจอหันหาลูกค้า
export default async function PosDisplayPage() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/login?next=/pos-display");
  if (!ctx.org) redirect("/onboarding");

  return (
    <DisplayClient
      orgId={ctx.org.id}
      orgName={ctx.org.name}
      orgLogo={ctx.org.logo_url}
    />
  );
}
