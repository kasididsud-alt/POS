import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/auth";
import { getProductsWithStock } from "@/lib/queries";
import CountClient from "./CountClient";

export default async function StockCountPage() {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/onboarding");

  const products = await getProductsWithStock(ctx.org.id, ctx.branchId, { activeOnly: true });

  return (
    <CountClient
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        qty: p.qty,
      }))}
    />
  );
}
