import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { getProductsWithStock } from "@/lib/queries";
import TransfersClient from "./TransfersClient";

export type TransferRow = {
  id: string;
  transfer_no: string;
  status: string;
  note: string | null;
  created_at: string;
  from_name: string | null;
  to_name: string | null;
  items: number;
};

export default async function TransfersPage() {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/onboarding");
  const orgId = ctx.org.id;

  const [products, branches, transfers] = await Promise.all([
    getProductsWithStock(orgId, ctx.branchId, { activeOnly: true }),
    query<{ id: string; name: string; type: string }>(
      "select id, name, type from branches where org_id=$1 order by created_at",
      [orgId],
    ),
    query<TransferRow>(
      `select t.id, t.transfer_no, t.status, t.note, t.created_at,
              bf.name as from_name, bt.name as to_name,
              (select count(*) from stock_transfer_items i where i.transfer_id = t.id)::int as items
         from stock_transfers t
         left join branches bf on bf.id = t.from_branch_id
         left join branches bt on bt.id = t.to_branch_id
        where t.org_id = $1
        order by t.created_at desc limit 50`,
      [orgId],
    ),
  ]);

  return (
    <TransfersClient
      products={products.map((p) => ({ id: p.id, name: p.name, qty: p.qty }))}
      branches={branches}
      transfers={transfers}
    />
  );
}
