import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { getProductsWithStock } from "@/lib/queries";
import IssueClient from "./IssueClient";

type RecentIssue = {
  id: string;
  qty_change: number;
  note: string | null;
  created_at: string;
  product_name: string | null;
};

export default async function StockIssuePage() {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/onboarding");
  const orgId = ctx.org.id;

  const [products, recent] = await Promise.all([
    getProductsWithStock(orgId, ctx.branchId, { activeOnly: true }),
    query<RecentIssue>(
      `select m.id, m.qty_change, m.note, m.created_at, p.name as product_name
         from stock_movements m
         left join products p on p.id = m.product_id
        where m.org_id = $1 and m.branch_id = $2 and m.reason = 'adjust' and m.qty_change < 0
        order by m.created_at desc limit 20`,
      [orgId, ctx.branchId],
    ),
  ]);

  return (
    <IssueClient
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        qty: p.qty,
      }))}
      recent={recent}
    />
  );
}
