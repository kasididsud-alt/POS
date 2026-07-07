import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import type { CustomerWithStats } from "@/lib/types";
import CustomersClient from "./CustomersClient";

export default async function CustomersPage() {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/onboarding");

  const customers = await query<CustomerWithStats>(
    `select c.*,
            count(s.id)::int as bills,
            coalesce(sum(s.total), 0) as total_spent
       from customers c
       left join sales s on s.customer_id = c.id
      where c.org_id = $1
      group by c.id
      order by c.created_at desc`,
    [ctx.org.id],
  );

  return <CustomersClient customers={customers} />;
}
