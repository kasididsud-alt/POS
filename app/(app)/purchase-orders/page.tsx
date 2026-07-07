import { requireOwnerPage } from "@/lib/guard";
import { query } from "@/lib/db";
import { getProductsWithStock } from "@/lib/queries";
import type { Supplier } from "@/lib/types";
import POClient from "./POClient";

export type PORow = {
  id: string;
  po_no: string;
  status: string;
  total: number;
  created_at: string;
  supplier_name: string | null;
  items: number;
};

export default async function PurchaseOrdersPage() {
  const ctx = await requireOwnerPage();
  const orgId = ctx.org.id;

  const [products, suppliers, pos] = await Promise.all([
    getProductsWithStock(orgId, ctx.branchId, { activeOnly: true }),
    query<Supplier>("select * from suppliers where org_id=$1 order by name", [orgId]),
    query<PORow>(
      `select po.id, po.po_no, po.status, po.total, po.created_at,
              s.name as supplier_name,
              (select count(*) from purchase_order_items i where i.po_id = po.id)::int as items
         from purchase_orders po
         left join suppliers s on s.id = po.supplier_id
        where po.org_id = $1
        order by po.created_at desc limit 50`,
      [orgId],
    ),
  ]);

  return (
    <POClient
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        cost: Number(p.cost),
        qty: p.qty,
      }))}
      suppliers={suppliers}
      pos={pos}
    />
  );
}
