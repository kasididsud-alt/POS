import { requireOwnerPage } from "@/lib/guard";
import { query } from "@/lib/db";
import type { Supplier } from "@/lib/types";
import SuppliersClient from "./SuppliersClient";

export default async function SuppliersPage() {
  const ctx = await requireOwnerPage();

  const suppliers = await query<Supplier>(
    "select * from suppliers where org_id=$1 order by created_at desc",
    [ctx.org.id],
  );

  return <SuppliersClient suppliers={suppliers} />;
}
