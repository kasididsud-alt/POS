import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import MembersClient from "./MembersClient";

export type MemberRow = {
  id: string;
  name: string;
  phone: string | null;
  points: number;
  total_spent: number;
};

export default async function MembersPage() {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/onboarding");

  const members = await query<MemberRow>(
    `select c.id, c.name, c.phone, c.points,
            coalesce(sum(s.total),0) as total_spent
       from customers c
       left join sales s on s.customer_id = c.id
      where c.org_id = $1
      group by c.id
      order by c.points desc, total_spent desc`,
    [ctx.org.id],
  );

  return <MembersClient members={members} />;
}
