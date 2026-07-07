export type NavItem = {
  href: string;
  label: string;
  icon: string;
  soon?: boolean;
  ownerOnly?: boolean;
};
export type NavGroup = { title: string; items: NavItem[] };

/** เส้นทางเฉพาะเจ้าของร้าน (พนักงานเข้าไม่ได้) */
export const OWNER_ONLY_PATHS = new Set([
  "/suppliers",
  "/purchase-orders",
  "/promotions",
  "/receivables",
  "/reports",
  "/vat-report",
  "/settings",
  "/billing",
  "/branches",
  "/staff",
  "/audit",
  "/integrations",
]);

/** กรองเมนูตาม role */
export function navGroupsForRole(role: string): NavGroup[] {
  if (role === "owner") return NAV_GROUPS;
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !OWNER_ONLY_PATHS.has(i.href)),
  })).filter((g) => g.items.length > 0);
}

// ---- สิทธิ์ตามแพ็ก (free < pro < premium) ----
// module นี้ต้อง client-safe (Sidebar/MobileNav เป็น client) ห้าม import ของฝั่ง server
export type PlanTier = "free" | "pro" | "premium";
const PLAN_RANK: Record<PlanTier, number> = { free: 0, pro: 1, premium: 2 };

/** path → แพ็กขั้นต่ำที่เข้าได้ (ไม่อยู่ในตาราง = free) */
export const PLAN_MIN_FOR_PATH: Record<string, PlanTier> = {
  // Pro ขึ้นไป
  "/customers": "pro",
  "/members": "pro",
  "/promotions": "pro",
  "/labels": "pro",
  "/reports": "pro",
  "/staff": "pro",
  "/sales-orders": "pro",
  // Premium เท่านั้น
  "/branches": "premium",
  "/transfers": "premium",
  "/stock-count": "premium",
  "/locations": "premium",
  "/lots": "premium",
  "/suppliers": "premium",
  "/purchase-orders": "premium",
  "/receivables": "premium",
  "/vat-report": "premium",
  "/audit": "premium",
  "/integrations": "premium",
};

/** แพ็กขั้นต่ำของ path (รองรับ sub-path เช่น /purchase-orders/123) */
export function minPlanForPath(path: string): PlanTier {
  for (const [p, tier] of Object.entries(PLAN_MIN_FOR_PATH)) {
    if (path === p || path.startsWith(p + "/")) return tier;
  }
  return "free";
}

/** แพ็กนี้เข้า path นี้ได้ไหม */
export function planAllowsPath(plan: PlanTier, path: string): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[minPlanForPath(path)];
}

/** กรองเมนูตาม role + แพ็ก (ซ่อนฟีเจอร์ที่แพ็กยังเข้าไม่ได้) */
export function navGroupsFor(role: string, plan: PlanTier): NavGroup[] {
  return navGroupsForRole(role)
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => planAllowsPath(plan, i.href)),
    }))
    .filter((g) => g.items.length > 0);
}

/** โครงเมนูเต็มระบบ — soon:true = หน้า "เร็วๆ นี้" (ยังไม่ลงรายละเอียด) */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "ภาพรวม",
    items: [
      { href: "/dashboard", label: "แดชบอร์ด", icon: "📊" },
      { href: "/alerts", label: "ศูนย์แจ้งเตือน", icon: "🔔" },
    ],
  },
  {
    title: "ขายหน้าร้าน",
    items: [
      { href: "/pos", label: "ขายหน้าร้าน (POS)", icon: "🧾" },
      { href: "/sales", label: "ประวัติบิล", icon: "🗂️" },
      { href: "/returns", label: "คืนสินค้า/คืนเงิน", icon: "↩️" },
      { href: "/shifts", label: "เปิด-ปิดกะ / นับเงิน", icon: "💵" },
    ],
  },
  {
    title: "สินค้า",
    items: [
      { href: "/products", label: "รายการสินค้า", icon: "📦" },
      { href: "/labels", label: "พิมพ์ป้ายบาร์โค้ด", icon: "🏷️" },
      { href: "/categories", label: "หมวดหมู่", icon: "📁" },
      { href: "/promotions", label: "โปรโมชั่น/ส่วนลด", icon: "🎯" },
      { href: "/lots", label: "Lot & วันหมดอายุ", icon: "⏳" },
    ],
  },
  {
    title: "คลังสินค้า",
    items: [
      { href: "/stock", label: "ภาพรวมคลัง", icon: "🏬" },
      { href: "/goods-receipt", label: "รับสินค้าเข้า", icon: "📥" },
      { href: "/stock-issue", label: "เบิก/ตัดจ่าย", icon: "📤" },
      { href: "/transfers", label: "โอนย้ายคลัง/สาขา", icon: "🔄" },
      { href: "/stock-count", label: "ตรวจนับสต็อก", icon: "📋" },
      { href: "/locations", label: "ตำแหน่งจัดเก็บ", icon: "🗺️" },
    ],
  },
  {
    title: "จัดซื้อ",
    items: [
      { href: "/suppliers", label: "ซัพพลายเออร์", icon: "🤝" },
      { href: "/purchase-orders", label: "ใบสั่งซื้อ (PO)", icon: "📝" },
    ],
  },
  {
    title: "ลูกค้า & ขายส่ง",
    items: [
      { href: "/customers", label: "ลูกค้า (CRM)", icon: "👤" },
      { href: "/members", label: "สมาชิก/แต้มสะสม", icon: "⭐" },
      { href: "/sales-orders", label: "ออเดอร์ขายส่ง", icon: "📑" },
      { href: "/receivables", label: "ลูกหนี้/เครดิต", icon: "💳" },
    ],
  },
  {
    title: "รายงาน",
    items: [
      { href: "/reports", label: "รายงาน", icon: "📈" },
      { href: "/vat-report", label: "ภาษีขาย (ภ.พ.30)", icon: "🧾" },
    ],
  },
  {
    title: "ตั้งค่า",
    items: [
      { href: "/settings", label: "ตั้งค่าร้าน", icon: "⚙️" },
      { href: "/billing", label: "แพ็กเกจ & ราคา", icon: "💎" },
      { href: "/branches", label: "สาขา/คลัง", icon: "🏢" },
      { href: "/staff", label: "พนักงาน & สิทธิ์", icon: "👥" },
      { href: "/audit", label: "บันทึกการใช้งาน", icon: "📜" },
      { href: "/integrations", label: "การเชื่อมต่อ", icon: "🔌" },
    ],
  },
];

/** เมนูหลักสำหรับ bottom bar บนมือถือ */
export const MOBILE_NAV: NavItem[] = [
  { href: "/dashboard", label: "ภาพรวม", icon: "📊" },
  { href: "/pos", label: "ขาย", icon: "🧾" },
  { href: "/products", label: "สินค้า", icon: "📦" },
  { href: "/sales", label: "บิล", icon: "🗂️" },
  { href: "/settings", label: "ตั้งค่า", icon: "⚙️" },
];
