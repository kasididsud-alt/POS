import type { Metadata } from "next";
import Hero from "@/components/landing/Hero";
import {
  ClosingCta,
  FeatureGrid,
  LandingFaq,
  LandingFooter,
  Outcomes,
  RetailWorkflow,
  StoreFit,
} from "@/components/landing/LandingSections";
import Pricing from "@/components/landing/Pricing";
import ProductShowcase from "@/components/landing/ProductShowcase";
import { FAQ_ITEMS } from "@/components/landing/content";
import { getAppContext } from "@/lib/auth";
import { PLANS, PUBLIC_PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "ขายดี Stock",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description:
        "ระบบ POS และคลังสินค้าสำหรับร้านขายสินค้าไทย เชื่อมทุกบิลกับสต็อกและรายงานในที่เดียว",
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "THB",
        lowPrice: String(PLANS.free.monthly),
        highPrice: String(PLANS.premium.monthly),
        offerCount: String(PUBLIC_PLANS.length),
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ],
};

export default async function LandingPage() {
  const ctx = await getAppContext();
  const isAuthed = Boolean(ctx);

  return (
    <div className="lp lp-home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <Hero isAuthed={isAuthed} />
      <main>
        <Outcomes />
        <ProductShowcase />
        <RetailWorkflow />
        <FeatureGrid />
        <StoreFit />
        <Pricing tiers={PUBLIC_PLANS} />
        <LandingFaq />
        <ClosingCta isAuthed={isAuthed} />
      </main>
      <LandingFooter />
    </div>
  );
}
