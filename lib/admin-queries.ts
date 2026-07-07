// Query สำหรับหน้า admin dashboard (ระดับแพลตฟอร์ม — ข้ามทุก org)
import { query, one } from "@/lib/db";
import { planForOrg, type PlanId } from "@/lib/plans";
import type { Subscription } from "@/lib/types";

// แถว subscription บางส่วนที่พอให้ planForOrg() ใช้ derive แพ็กเกจได้
type SubShape = Pick<
  Subscription,
  "status" | "price_id" | "trial_ends_at" | "comp_plan"
>;

/** derive แพ็กเกจปัจจุบันของร้านจากคอลัมน์ subscription (null = ยังไม่มี subscription → free) */
export function derivePlan(sub: SubShape | null): PlanId {
  if (!sub) return "free";
  return planForOrg(sub as Subscription);
}

export type AdminOverview = {
  totalUsers: number;
  newUsers7d: number;
  totalOrgs: number;
  newOrgs7d: number;
  totalSales: number;
  totalRevenue: number;
  salesToday: number;
  revenueToday: number;
  planCounts: Record<PlanId, number>;
  statusCounts: Record<string, number>;
  recentUsers: {
    id: string;
    email: string;
    full_name: string | null;
    google_sub: string | null;
    created_at: string;
  }[];
  recentOrgs: {
    id: string;
    name: string;
    created_at: string;
    plan: PlanId;
  }[];
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const users = await one<{ total: number; new7d: number }>(
    `select count(*)::int as total,
            count(*) filter (where created_at > now() - interval '7 days')::int as new7d
       from users`,
  );
  const orgs = await one<{ total: number; new7d: number }>(
    `select count(*)::int as total,
            count(*) filter (where created_at > now() - interval '7 days')::int as new7d
       from organizations`,
  );
  const sales = await one<{
    total: number;
    revenue: number;
    today: number;
    revenue_today: number;
  }>(
    `select count(*)::int as total,
            coalesce(sum(total), 0)::float as revenue,
            count(*) filter (where created_at::date = now()::date)::int as today,
            coalesce(sum(total) filter (where created_at::date = now()::date), 0)::float as revenue_today
       from sales`,
  );

  // แพ็กเกจ + สถานะ — ดึง subscription ทั้งหมดมา tally ในแอป (org น้อย)
  const subs = await query<SubShape>(
    "select status, price_id, trial_ends_at, comp_plan from subscriptions",
  );
  const planCounts: Record<PlanId, number> = { free: 0, pro: 0, premium: 0 };
  const statusCounts: Record<string, number> = {};
  for (const s of subs) {
    planCounts[derivePlan(s)]++;
    statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;
  }
  // ร้านที่ยังไม่มีแถว subscription = ถือเป็น free
  const orgsWithoutSub = (orgs?.total ?? 0) - subs.length;
  if (orgsWithoutSub > 0) planCounts.free += orgsWithoutSub;

  const recentUsers = await query<AdminOverview["recentUsers"][number]>(
    `select id, email, full_name, google_sub, created_at
       from users order by created_at desc limit 8`,
  );
  const recentOrgRows = await query<{
    id: string;
    name: string;
    created_at: string;
    status: string | null;
    price_id: string | null;
    trial_ends_at: string | null;
    comp_plan: string | null;
  }>(
    `select o.id, o.name, o.created_at,
            sub.status, sub.price_id, sub.trial_ends_at, sub.comp_plan
       from organizations o
       left join subscriptions sub on sub.org_id = o.id
      order by o.created_at desc limit 8`,
  );
  const recentOrgs = recentOrgRows.map((r) => ({
    id: r.id,
    name: r.name,
    created_at: r.created_at,
    plan: r.status
      ? derivePlan({
          status: r.status as Subscription["status"],
          price_id: r.price_id,
          trial_ends_at: r.trial_ends_at,
          comp_plan: r.comp_plan,
        })
      : ("free" as PlanId),
  }));

  return {
    totalUsers: users?.total ?? 0,
    newUsers7d: users?.new7d ?? 0,
    totalOrgs: orgs?.total ?? 0,
    newOrgs7d: orgs?.new7d ?? 0,
    totalSales: sales?.total ?? 0,
    totalRevenue: sales?.revenue ?? 0,
    salesToday: sales?.today ?? 0,
    revenueToday: sales?.revenue_today ?? 0,
    planCounts,
    statusCounts,
    recentUsers,
    recentOrgs,
  };
}

export type AdminOrgRow = {
  id: string;
  name: string;
  created_at: string;
  members: number;
  sales_count: number;
  revenue: number;
  plan: PlanId;
  status: string | null;
  comp_plan: string | null;
};

/** รายชื่อร้านทั้งหมด (ค้นด้วยชื่อได้) */
export async function getAdminOrgs(q?: string): Promise<AdminOrgRow[]> {
  const rows = await query<{
    id: string;
    name: string;
    created_at: string;
    members: number;
    sales_count: number;
    revenue: number;
    status: string | null;
    price_id: string | null;
    trial_ends_at: string | null;
    comp_plan: string | null;
  }>(
    `select o.id, o.name, o.created_at,
            (select count(*)::int from memberships m where m.org_id = o.id) as members,
            (select count(*)::int from sales s where s.org_id = o.id) as sales_count,
            (select coalesce(sum(total), 0)::float from sales s where s.org_id = o.id) as revenue,
            sub.status, sub.price_id, sub.trial_ends_at, sub.comp_plan
       from organizations o
       left join subscriptions sub on sub.org_id = o.id
      where ($1::text is null or o.name ilike '%' || $1 || '%')
      order by o.created_at desc
      limit 200`,
    [q && q.trim() ? q.trim() : null],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    created_at: r.created_at,
    members: r.members,
    sales_count: r.sales_count,
    revenue: r.revenue,
    status: r.status,
    comp_plan: r.comp_plan,
    plan: r.status
      ? derivePlan({
          status: r.status as Subscription["status"],
          price_id: r.price_id,
          trial_ends_at: r.trial_ends_at,
          comp_plan: r.comp_plan,
        })
      : ("free" as PlanId),
  }));
}

export type AdminOrgMember = {
  user_id: string;
  role: string;
  email: string;
  full_name: string | null;
  created_at: string;
};

export type AdminOrgDetail = {
  org: {
    id: string;
    name: string;
    promptpay_id: string | null;
    created_at: string;
  };
  subscription: Subscription | null;
  plan: PlanId;
  members: AdminOrgMember[];
  productCount: number;
  salesCount: number;
  revenue: number;
};

/** รายละเอียดร้านเดียว (null ถ้าไม่พบ) */
export async function getAdminOrgDetail(
  orgId: string,
): Promise<AdminOrgDetail | null> {
  const org = await one<AdminOrgDetail["org"]>(
    "select id, name, promptpay_id, created_at from organizations where id = $1",
    [orgId],
  );
  if (!org) return null;

  const subscription = await one<Subscription>(
    "select * from subscriptions where org_id = $1",
    [orgId],
  );
  const members = await query<AdminOrgMember>(
    `select m.user_id, m.role, m.created_at, u.email, u.full_name
       from memberships m join users u on u.id = m.user_id
      where m.org_id = $1
      order by (m.role = 'owner') desc, m.created_at asc`,
    [orgId],
  );
  const stats = await one<{ products: number; sales: number; revenue: number }>(
    `select (select count(*)::int from products where org_id = $1) as products,
            (select count(*)::int from sales where org_id = $1) as sales,
            (select coalesce(sum(total), 0)::float from sales where org_id = $1) as revenue`,
    [orgId],
  );

  return {
    org,
    subscription,
    plan: derivePlan(subscription),
    members,
    productCount: stats?.products ?? 0,
    salesCount: stats?.sales ?? 0,
    revenue: stats?.revenue ?? 0,
  };
}

export type AdminUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  google_sub: string | null;
  created_at: string;
  memberships: { org_id: string; org_name: string; role: string }[];
};

/** รายชื่อผู้ใช้ทั้งหมด (ค้นด้วยอีเมลได้) พร้อมสังกัดร้าน + role */
export async function getAdminUsers(q?: string): Promise<AdminUserRow[]> {
  const users = await query<{
    id: string;
    email: string;
    full_name: string | null;
    google_sub: string | null;
    created_at: string;
  }>(
    `select id, email, full_name, google_sub, created_at
       from users
      where ($1::text is null or email ilike '%' || $1 || '%')
      order by created_at desc
      limit 200`,
    [q && q.trim() ? q.trim() : null],
  );
  if (users.length === 0) return [];

  const ids = users.map((u) => u.id);
  const memberships = await query<{
    user_id: string;
    org_id: string;
    org_name: string;
    role: string;
  }>(
    `select m.user_id, m.org_id, o.name as org_name, m.role
       from memberships m join organizations o on o.id = m.org_id
      where m.user_id = any($1::uuid[])`,
    [ids],
  );
  const byUser = new Map<string, AdminUserRow["memberships"]>();
  for (const m of memberships) {
    const arr = byUser.get(m.user_id) ?? [];
    arr.push({ org_id: m.org_id, org_name: m.org_name, role: m.role });
    byUser.set(m.user_id, arr);
  }
  return users.map((u) => ({ ...u, memberships: byUser.get(u.id) ?? [] }));
}
