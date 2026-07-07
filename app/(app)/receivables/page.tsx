import { requireOwnerPage } from "@/lib/guard";
import { query } from "@/lib/db";
import type { Customer } from "@/lib/types";
import ReceivablesClient from "./ReceivablesClient";

export type DebtRow = {
  id: string;
  amount: number;
  paid: number;
  due_date: string | null;
  note: string | null;
  status: string;
  created_at: string;
  customer_name: string | null;
};

export default async function ReceivablesPage() {
  const ctx = await requireOwnerPage();
  const orgId = ctx.org.id;

  const [debts, customers] = await Promise.all([
    query<DebtRow>(
      `select d.id, d.amount, d.paid, d.due_date, d.note, d.status, d.created_at,
              c.name as customer_name
         from debts d
         left join customers c on c.id = d.customer_id
        where d.org_id = $1
        order by (d.status='open') desc, d.created_at desc
        limit 100`,
      [orgId],
    ),
    query<Customer>("select * from customers where org_id=$1 order by name", [orgId]),
  ]);

  return <ReceivablesClient debts={debts} customers={customers} />;
}
