import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { getAppContext } from "@/lib/auth";

async function createOrgAction(formData: FormData) {
  "use server";
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");
  // idempotent: มีร้านอยู่แล้ว (double-submit / back-button / POST ตรง) → ไม่สร้างซ้ำ
  if (ctx.org) redirect("/dashboard");

  const name = String(formData.get("shop_name") ?? "").trim();
  const promptpay = String(formData.get("promptpay") ?? "").trim() || null;
  if (!name) redirect("/onboarding?error=1");

  await query("select create_organization($1, $2, $3)", [
    ctx.userId,
    name,
    promptpay,
  ]);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export default async function OnboardingPage() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");
  if (ctx.org) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold">เปิดร้านของคุณ</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          ตั้งชื่อร้านเพื่อเริ่มใช้งานระบบ
        </p>
        <form action={createOrgAction} className="mt-6 space-y-4">
          <div>
            <label className="label">ชื่อร้าน</label>
            <input name="shop_name" required className="input" />
          </div>
          <div>
            <label className="label">เบอร์พร้อมเพย์ (ไม่บังคับ)</label>
            <input name="promptpay" placeholder="เช่น 0812345678" className="input" />
            <p className="mt-1 text-xs text-[var(--muted)]">
              ใช้สร้าง QR รับเงินหน้าร้าน เพิ่มภายหลังในตั้งค่าได้
            </p>
          </div>
          <button type="submit" className="btn-primary w-full">
            เริ่มใช้งาน
          </button>
        </form>
      </div>
    </div>
  );
}
