import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/auth";
import { getProductsWithStock } from "@/lib/queries";
import LabelsClient from "./LabelsClient";

export default async function LabelsPage() {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/onboarding");

  const products = await getProductsWithStock(ctx.org.id, ctx.branchId);
  return <LabelsClient products={products} orgName={ctx.org.name} />;
}
