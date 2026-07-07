import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import LotsClient from "./LotsClient";

export type LotRow = {
  id: string;
  product_id: string;
  lot_no: string | null;
  expiry_date: string | null;
  qty: number;
  product_name: string | null;
};

export default async function LotsPage() {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/onboarding");
  const orgId = ctx.org.id;

  const [lots, products] = await Promise.all([
    query<LotRow>(
      `select l.id, l.product_id, l.lot_no, l.expiry_date, l.qty, p.name as product_name
         from product_lots l left join products p on p.id = l.product_id
        where l.org_id = $1
        order by l.expiry_date asc nulls last`,
      [orgId],
    ),
    query<{ id: string; name: string }>(
      "select id, name from products where org_id=$1 and is_active order by name",
      [orgId],
    ),
  ]);

  return <LotsClient lots={lots} products={products} />;
}
