import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import ReturnsClient from "./ReturnsClient";

type SaleItemLite = {
  product_id: string | null;
  name: string;
  unit_price: number;
  qty: number;
};
export type SaleWithItems = {
  id: string;
  bill_no: string;
  total: number;
  created_at: string;
  items: SaleItemLite[];
};

export default async function ReturnsPage() {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/onboarding");
  const orgId = ctx.org.id;

  const sales = await query<SaleWithItems>(
    `select s.id, s.bill_no, s.total, s.created_at,
            json_agg(json_build_object(
              'product_id', si.product_id,
              'name', si.name_snapshot,
              'unit_price', si.unit_price,
              'qty', si.qty
            )) as items
       from sales s
       join sale_items si on si.sale_id = s.id
      where s.org_id = $1
      group by s.id
      order by s.created_at desc
      limit 30`,
    [orgId],
  );

  const recent = await query<{
    id: string;
    total_refund: number;
    reason: string | null;
    created_at: string;
    bill_no: string | null;
  }>(
    `select r.id, r.total_refund, r.reason, r.created_at, s.bill_no
       from sale_returns r
       left join sales s on s.id = r.sale_id
      where r.org_id = $1
      order by r.created_at desc limit 20`,
    [orgId],
  );

  return <ReturnsClient sales={sales} recent={recent} />;
}
