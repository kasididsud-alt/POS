import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/auth";
import { getProductsWithStock, getCategories, countExpiringLots } from "@/lib/queries";
import { planForOrg } from "@/lib/plans";
import StockClient from "./StockClient";

export default async function StockPage() {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/onboarding");

  const [products, categories, expiringLots] = await Promise.all([
    getProductsWithStock(ctx.org.id, ctx.branchId, { activeOnly: true }),
    getCategories(ctx.org.id),
    countExpiringLots(ctx.org.id, 30),
  ]);

  const plan = planForOrg(ctx.subscription);
  const branchName =
    ctx.branches.length > 1
      ? (ctx.branches.find((b) => b.id === ctx.branchId)?.name ?? null)
      : null;

  return (
    <StockClient
      products={products}
      categories={categories}
      expiringLots={expiringLots}
      plan={plan}
      branchName={branchName}
    />
  );
}
