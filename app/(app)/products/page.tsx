import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/auth";
import { getCategories, getProductsWithStock } from "@/lib/queries";
import ProductsClient from "./ProductsClient";

export default async function ProductsPage() {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/onboarding");

  const [products, categories] = await Promise.all([
    getProductsWithStock(ctx.org.id, ctx.branchId),
    getCategories(ctx.org.id),
  ]);

  return <ProductsClient products={products} categories={categories} />;
}
