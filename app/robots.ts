import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // หน้าหลังบ้าน (ต้องล็อกอิน) ไม่ต้องให้ index
      disallow: [
        "/api/",
        "/admin",
        "/dashboard",
        "/billing",
        "/returns",
        "/labels",
        "/vat-report",
        "/pos",
        "/products",
        "/sales",
        "/settings",
        "/account",
        "/onboarding",
        "/customers",
        "/suppliers",
        "/purchase-orders",
        "/reports",
        "/stock",
        "/staff",
        "/branches",
        "/audit",
        "/integrations",
        "/promotions",
        "/receivables",
        "/members",
        "/sales-orders",
        "/transfers",
        "/stock-issue",
        "/stock-count",
        "/goods-receipt",
        "/lots",
        "/locations",
        "/alerts",
        "/shifts",
        "/categories",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
