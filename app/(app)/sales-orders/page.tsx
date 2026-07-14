import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getAppContext } from "@/lib/auth";
import { getProductsWithStock } from "@/lib/queries";
import type { Customer } from "@/lib/types";
import SOClient from "./SOClient";

export type SORow = {
  id: string;
  so_no: string;
  status: string;
  total: number;
  created_at: string;
  customer_name: string | null;
  items: number;
};

export default async function SalesOrdersPage() {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/onboarding");
  const orgId = ctx.org.id;

  const [products, customers, orders, gateway] = await Promise.all([
    getProductsWithStock(orgId, ctx.branchId, { activeOnly: true }),
    query<Customer>("select * from customers where org_id=$1 order by name", [orgId]),
    query<SORow>(
      `select so.id, so.so_no, so.status, so.total, so.created_at,
              c.name as customer_name,
              (select count(*) from sales_order_items i where i.so_id = so.id)::int as items
         from sales_orders so
         left join customers c on c.id = so.customer_id
        where so.org_id = $1
        order by so.created_at desc limit 50`,
      [orgId],
    ),
    // เชื่อม gateway แล้วหรือยัง — ใช้โชว์/ซ่อนปุ่ม "ลิงก์จ่ายเงิน"
    query("select 1 from payment_gateway_settings where org_id=$1", [orgId]),
  ]);

  // เชื่อม SMS แล้วหรือยัง — ใช้โชว์/ซ่อนปุ่ม "SMS แจ้งลูกค้า"
  const sms = await query("select 1 from sms_settings where org_id=$1", [orgId]);

  return (
    <SOClient
      products={products.map((p) => ({ id: p.id, name: p.name, price: Number(p.price) }))}
      customers={customers}
      orders={orders}
      gatewayConnected={gateway.length > 0}
      smsConnected={sms.length > 0}
    />
  );
}
