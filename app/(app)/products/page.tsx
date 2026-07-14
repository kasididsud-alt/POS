import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/auth";
import { one } from "@/lib/db";
import { getCategories, getProductsPage } from "@/lib/queries";
import ProductsClient from "./ProductsClient";

const PAGE_SIZE = 50;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/onboarding");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(parseInt(sp.page ?? "1", 10) || 1, 1);

  const [{ rows: products, total }, categories, missing] = await Promise.all([
    getProductsPage(ctx.org.id, ctx.branchId, { q, page, pageSize: PAGE_SIZE }),
    getCategories(ctx.org.id),
    // นับสินค้าที่ยังไม่มีบาร์โค้ดจากทั้งร้าน (ไม่ใช่แค่หน้าปัจจุบัน)
    one<{ n: number }>(
      "select count(*)::int as n from products where org_id=$1 and is_active=true and (barcode is null or barcode='')",
      [ctx.org.id],
    ),
  ]);

  return (
    <ProductsClient
      products={products}
      categories={categories}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      q={q}
      missingBarcodes={missing?.n ?? 0}
    />
  );
}
