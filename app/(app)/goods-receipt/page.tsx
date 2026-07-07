import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { getProductsWithStock } from "@/lib/queries";
import type { Supplier } from "@/lib/types";
import ReceiveClient from "./ReceiveClient";

type RecentReceipt = {
  id: string;
  ref_no: string | null;
  total_cost: number;
  created_at: string;
  supplier_name: string | null;
  items: number;
};

export default async function GoodsReceiptPage() {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/onboarding");
  const orgId = ctx.org.id;

  const [products, suppliers, recent] = await Promise.all([
    getProductsWithStock(orgId, ctx.branchId, { activeOnly: true }),
    query<Supplier>("select * from suppliers where org_id=$1 order by name", [orgId]),
    query<RecentReceipt>(
      `select g.id, g.ref_no, g.total_cost, g.created_at,
              s.name as supplier_name,
              (select count(*) from goods_receipt_items i where i.receipt_id = g.id)::int as items
         from goods_receipts g
         left join suppliers s on s.id = g.supplier_id
        where g.org_id = $1
        order by g.created_at desc limit 20`,
      [orgId],
    ),
  ]);

  return (
    <ReceiveClient
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        cost: Number(p.cost),
        unit: p.unit,
        qty: p.qty,
      }))}
      suppliers={suppliers}
      recent={recent}
    />
  );
}
