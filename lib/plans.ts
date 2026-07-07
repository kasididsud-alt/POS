import type { Subscription } from "@/lib/types";
import { planFromPriceId } from "@/lib/stripe";
import { resolvePlanWithComp } from "@/lib/billing";

export type PlanId = "free" | "pro" | "premium";
export type PlanInterval = "monthly" | "yearly";

export type PlanLimits = {
  /** จำนวนสินค้าสูงสุด (Infinity = ไม่จำกัด) */
  products: number;
  branches: number;
  users: number;
  /** rate limit กัน API รัวๆ (request/นาที ต่อผู้ใช้) */
  rpm: number;
};

export type PlanDef = {
  id: PlanId;
  name: string;
  tagline: string;
  /** ราคาบาท (0 = ฟรี) */
  monthly: number;
  yearly: number;
  limits: PlanLimits;
  features: string[];
  highlight?: boolean;
};

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "เริ่มต้น",
    tagline: "ร้านเล็ก เพิ่งเริ่ม",
    monthly: 0,
    yearly: 0,
    limits: { products: 80, branches: 1, users: 1, rpm: 120 },
    features: [
      "1 สาขา · 1 ผู้ใช้",
      "สินค้าไม่เกิน 80 รายการ",
      "POS + ตัดสต็อกอัตโนมัติ",
      "รับเงินสด / พร้อมเพย์",
      "สแกนบาร์โค้ด + ใบเสร็จ",
      "รายงานยอดขายพื้นฐาน",
    ],
  },
  pro: {
    id: "pro",
    name: "ร้านค้า",
    tagline: "ร้านทั่วไป — ยอดนิยม",
    monthly: 399,
    yearly: 3990,
    highlight: true,
    limits: { products: 500, branches: 1, users: 5, rpm: 600 },
    features: [
      "ทุกอย่างในแพ็กเริ่มต้น",
      "สินค้าไม่เกิน 500 · บิลไม่จำกัด",
      "พนักงานถึง 5 คน + แยกสิทธิ์",
      "ลูกค้า / แต้ม / โปรโมชั่น",
      "รายงานเต็ม + กำไรแม่นยำ",
      "พิมพ์ฉลาก/บาร์โค้ด + แจ้งเตือนสต็อก",
    ],
  },
  premium: {
    id: "premium",
    name: "มืออาชีพ",
    tagline: "หลายสาขา / คลังใหญ่",
    monthly: 990,
    yearly: 9900,
    limits: { products: 5000, branches: Infinity, users: Infinity, rpm: 2000 },
    features: [
      "ทุกอย่างในแพ็กร้านค้า",
      "สินค้าไม่เกิน 5,000 · ผู้ใช้ไม่จำกัด",
      "หลายสาขา + โอนย้ายสต็อก",
      "ตรวจนับ + ตำแหน่งจัดเก็บ + ล็อตสินค้า",
      "ใบสั่งซื้อ (PO) + ซัพพลายเออร์",
      "ลูกหนี้/ขายเชื่อ + VAT + Export",
      "สิทธิ์ละเอียด + audit log",
    ],
  },
};

export const PAID_PLAN_IDS: Exclude<PlanId, "free">[] = ["pro", "premium"];

const RANK: Record<PlanId, number> = { free: 0, pro: 1, premium: 2 };
export function planRank(p: PlanId): number {
  return RANK[p];
}

/** subscription จ่ายเงิน/ทดลอง ยังมีผลไหม — เวอร์ชันที่ "ไม่สน comp" (comp คิดแยกใน planForOrg) */
function paidActive(sub: Subscription | null): boolean {
  if (!sub) return false;
  const now = Date.now();
  if (sub.status === "active") return true;
  if (sub.status === "trialing") {
    if (!sub.trial_ends_at) return true;
    return new Date(sub.trial_ends_at).getTime() > now;
  }
  return false;
}

/** แพ็กจริงจาก subscription (Stripe/trial) — ไม่รวม comp_plan */
function realPlanFromSub(sub: Subscription | null): PlanId {
  if (!paidActive(sub)) return "free";
  const byPrice = sub?.price_id ? planFromPriceId(sub.price_id)?.plan : null;
  if (byPrice) return byPrice;
  if (sub?.status === "trialing") return "pro";
  return "free";
}

/**
 * แพ็กปัจจุบันของ org — derive จาก subscription
 * - DEV_PLAN env ใช้ override ตอน local/ทดสอบ (ยังไม่มี Stripe)
 * - trialing (ไม่มี price) = ได้ Pro ระหว่างทดลอง
 * - อื่นๆ / หมดอายุ = free
 *
 * comp_plan (ผู้ดูแลระบบแถมแพ็กให้) ทำหน้าที่เป็น "พื้น" (floor) — ยกระดับได้อย่างเดียว
 * ห้ามลดต่ำกว่าสิทธิ์ที่จ่ายเงินจริง. ป้องกันเคส admin ตั้ง comp='free' บนร้านที่มี Stripe
 * Premium อยู่ แล้วลูกค้าถูกล็อกเป็น free ทั้งที่ยังโดนเรียกเก็บเงิน.
 */
export function planForOrg(sub: Subscription | null): PlanId {
  const dev = process.env.DEV_PLAN as PlanId | undefined;
  if (dev && dev in PLANS) return dev;

  const real = realPlanFromSub(sub);
  return resolvePlanWithComp(real, sub?.comp_plan);
}
