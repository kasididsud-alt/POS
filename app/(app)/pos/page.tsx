import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { getProductsWithStock } from "@/lib/queries";
import PosClient, { type PosCustomer, type PosPromotion } from "./PosClient";

export default async function PosPage() {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/onboarding");
  const orgId = ctx.org.id;

  const [products, customers, promotions] = await Promise.all([
    getProductsWithStock(orgId, ctx.branchId, { activeOnly: true }),
    query<PosCustomer>(
      "select id, name, phone, points from customers where org_id=$1 order by name",
      [orgId],
    ),
    query<PosPromotion>(
      `select id, name, type, value, min_purchase
         from promotions
        where org_id=$1 and is_active = true
          and (starts_at is null or starts_at <= now()::date)
          and (ends_at is null or ends_at >= now()::date)`,
      [orgId],
    ),
  ]);

  return (
    <PosClient
      products={products}
      hasPromptPay={!!ctx.org.promptpay_id}
      customers={customers}
      promotions={promotions}
      orgId={orgId}
      branchId={ctx.branchId}
    />
  );
}
