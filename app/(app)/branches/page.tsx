import { requireOwnerPage } from "@/lib/guard";
import { query } from "@/lib/db";
import BranchesClient from "./BranchesClient";

export type Branch = {
  id: string;
  name: string;
  type: "shop" | "warehouse";
  address: string | null;
  phone: string | null;
  is_default: boolean;
};

export default async function BranchesPage() {
  const ctx = await requireOwnerPage();

  const branches = await query<Branch>(
    "select id, name, type, address, phone, is_default from branches where org_id=$1 order by created_at",
    [ctx.org.id],
  );

  return <BranchesClient branches={branches} />;
}
