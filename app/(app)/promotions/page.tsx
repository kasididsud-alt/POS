import { requireOwnerPage } from "@/lib/guard";
import { query } from "@/lib/db";
import PromotionsClient from "./PromotionsClient";

export type Promotion = {
  id: string;
  name: string;
  type: "percent" | "amount";
  value: number;
  min_purchase: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

export default async function PromotionsPage() {
  const ctx = await requireOwnerPage();

  const promotions = await query<Promotion>(
    "select id, name, type, value, min_purchase, starts_at, ends_at, is_active from promotions where org_id=$1 order by created_at desc",
    [ctx.org.id],
  );

  return <PromotionsClient promotions={promotions} />;
}
