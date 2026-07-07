import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import CategoriesClient from "./CategoriesClient";

export default async function CategoriesPage() {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/onboarding");

  const categories = await query<{
    id: string;
    name: string;
    product_count: number;
  }>(
    `select c.id, c.name,
            count(p.id) filter (where p.is_active)::int as product_count
       from categories c
       left join products p on p.category_id = c.id
      where c.org_id = $1
      group by c.id
      order by c.name`,
    [ctx.org.id],
  );

  return <CategoriesClient categories={categories} />;
}
