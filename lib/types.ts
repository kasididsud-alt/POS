// Domain types (sync กับ db/schema.sql + db/modules/)

export type Role = "owner" | "cashier";
export type PaymentMethod = "cash" | "promptpay" | "credit";
export type StockReason = "purchase" | "sale" | "adjust" | "return" | "transfer";
export type BranchType = "shop" | "warehouse";

export type Branch = {
  id: string;
  org_id: string;
  name: string;
  type: BranchType;
  address: string | null;
  phone: string | null;
  is_default: boolean;
  created_at: string;
};
export type SubStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";

export type Organization = {
  id: string;
  name: string;
  promptpay_id: string | null;
  address: string | null;
  phone: string | null;
  tax_id: string | null;
  vat_registered: boolean;
  vat_rate: number;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Membership = {
  id: string;
  org_id: string;
  user_id: string;
  role: Role;
  branch_id: string | null;
  created_at: string;
};

export type Subscription = {
  org_id: string;
  stripe_subscription_id: string | null;
  status: SubStatus;
  price_id: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  // แพ็กเกจที่ผู้ดูแลระบบ comp ให้ (override subscription จริง) — 'free' | 'pro' | 'premium' | null
  comp_plan: string | null;
  updated_at: string;
};

export type Category = {
  id: string;
  org_id: string;
  name: string;
  created_at: string;
};

export type Customer = {
  id: string;
  org_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
  tax_id: string | null;
  branch: string | null;
  points: number;
  created_at: string;
  updated_at: string;
};

export type CustomerWithStats = Customer & {
  bills: number;
  total_spent: number;
};

export type Supplier = {
  id: string;
  org_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type ReceiptLine = {
  product_id: string;
  qty: number;
  unit_cost: number;
};

export type Product = {
  id: string;
  org_id: string;
  category_id: string | null;
  sku: string | null;
  barcode: string | null;
  name: string;
  price: number;
  cost: number;
  unit: string;
  image_url: string | null;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductWithStock = Product & {
  qty: number;
  category_name?: string | null;
};

export type Sale = {
  id: string;
  org_id: string;
  bill_no: string;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: PaymentMethod;
  cash_received: number | null;
  change_due: number | null;
  cashier_id: string | null;
  created_at: string;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string | null;
  name_snapshot: string;
  unit_price: number;
  qty: number;
  line_total: number;
};

// รายการในตะกร้าฝั่ง POS (ใช้แสดงผลใน UI เท่านั้น —
// ตอน checkout ส่งเข้า server แค่ product_id + qty ราคาอ่านจาก DB)
export type CartLine = {
  product_id: string;
  name: string;
  unit_price: number;
  qty: number;
};
