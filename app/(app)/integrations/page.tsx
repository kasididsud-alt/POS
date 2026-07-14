import { requireOwnerPage } from "@/lib/guard";
import { query, one } from "@/lib/db";
import ApiKeysClient from "./ApiKeysClient";
import LineNotifyClient from "./LineNotifyClient";
import GatewayClient from "./GatewayClient";
import SmsClient from "./SmsClient";
import ApiDocs from "./ApiDocs";
import AccountingExportClient from "./AccountingExportClient";
import PartnerCard from "./PartnerCard";

import type { PartnerInfo } from "./PartnerCard";

// พาร์ทเนอร์ที่ต้องมีบัญชี/สัญญากับผู้ให้บริการก่อนถึงเชื่อม API ได้ — การ์ดบอกวิธีเตรียมของ
const PARTNER_GROUPS: { title: string; items: PartnerInfo[] }[] = [
  {
    title: "ช่องทางขายออนไลน์",
    items: [
      {
        icon: "🛒",
        name: "Shopee",
        desc: "ดึงออเดอร์ + ซิงค์สต็อก",
        steps: [
          "สมัคร Shopee Open Platform (บัญชีผู้ขายต้องเปิดร้านอยู่แล้ว)",
          "สร้างแอปเพื่อรับ Partner ID + Partner Key",
          "ผูกร้านของคุณกับแอป (Shop Authorization)",
        ],
        portal: { label: "เปิด Shopee Open Platform", url: "https://open.shopee.com" },
      },
      {
        icon: "🛍️",
        name: "Lazada",
        desc: "ดึงออเดอร์ + ซิงค์สต็อก",
        steps: [
          "สมัคร Lazada Open Platform",
          "สร้างแอปเพื่อรับ App Key + App Secret",
          "กด Authorize ร้านของคุณให้แอปเข้าถึง",
        ],
        portal: { label: "เปิด Lazada Open Platform", url: "https://open.lazada.com" },
      },
      {
        icon: "🎵",
        name: "TikTok Shop",
        desc: "ดึงออเดอร์ + ซิงค์สต็อก",
        steps: [
          "สมัคร TikTok Shop Partner Center",
          "สร้างแอปเพื่อรับ App Key + App Secret",
          "ผูกร้าน TikTok Shop ของคุณกับแอป",
        ],
        portal: { label: "เปิด TikTok Shop Partner Center", url: "https://partner.tiktokshop.com" },
      },
      {
        icon: "💬",
        name: "LINE Shopping",
        desc: "รับออเดอร์ผ่าน LINE",
        steps: [
          "เปิดร้านบน LINE SHOPPING (MyShop)",
          "API สำหรับร้านทั่วไปยังจำกัด — ต้องติดต่อ LINE เพื่อขอสิทธิ์",
        ],
        portal: { label: "เปิด LINE MyShop", url: "https://manager.line.biz" },
      },
    ],
  },
  {
    title: "ขนส่ง",
    items: [
      {
        icon: "📦",
        name: "Flash Express",
        desc: "พิมพ์ใบปะหน้า + ติดตามพัสดุ",
        steps: [
          "สมัครลูกค้าธุรกิจกับ Flash Express",
          "ขอ Merchant ID + Secret Key จากฝ่ายขาย",
        ],
        portal: { label: "เว็บ Flash Express", url: "https://www.flashexpress.com" },
      },
      {
        icon: "🚚",
        name: "Kerry / J&T",
        desc: "สร้างเลขพัสดุ + COD",
        steps: [
          "ทำสัญญาลูกค้าธุรกิจกับ Kerry หรือ J&T",
          "ขอ API credentials จากฝ่ายขายของผู้ให้บริการ",
        ],
      },
    ],
  },
];

export default async function IntegrationsPage() {
  const ctx = await requireOwnerPage();

  const keys = await query<{
    id: string;
    name: string;
    prefix: string;
    last_used_at: string | null;
    created_at: string;
  }>(
    `select id, name, prefix, last_used_at, created_at
       from api_keys
      where org_id = $1 and revoked_at is null
      order by created_at desc`,
    [ctx.org.id],
  );

  // token ไม่ส่งลง client — ส่งเฉพาะปลายทาง + สถานะเปิด/ปิด
  const lineSettings = await one<{
    recipient_id: string;
    notify_low_stock: boolean;
  }>(
    "select recipient_id, notify_low_stock from line_settings where org_id = $1",
    [ctx.org.id],
  );

  // secret key ไม่ส่งลง client — ส่งเฉพาะชื่อ provider
  const gatewaySettings = await one<{ provider: "omise" | "stripe" }>(
    "select provider from payment_gateway_settings where org_id = $1",
    [ctx.org.id],
  );

  // secret ไม่ส่งลง client — ส่งเฉพาะ provider + ชื่อผู้ส่ง
  const smsSettings = await one<{
    provider: "thaibulksms" | "twilio";
    sender: string | null;
  }>("select provider, sender from sms_settings where org_id = $1", [ctx.org.id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">การเชื่อมต่อ</h1>
        <p className="text-sm text-[var(--muted)]">
          เชื่อมต่อผ่าน API ของเรา หรือช่องทางขาย/ขนส่ง/บัญชีภายนอก
        </p>
      </div>

      <ApiKeysClient keys={keys} />

      <ApiDocs siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? "https://your-domain.com"} />

      {/* ใช้งานได้จริงวันนี้ */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          บัญชี & การเงิน
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <GatewayClient settings={gatewaySettings} />
          <AccountingExportClient />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          สื่อสารกับลูกค้า
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <LineNotifyClient settings={lineSettings} />
          <SmsClient settings={smsSettings} />
        </div>
      </div>

      {/* ต้องมีบัญชีพาร์ทเนอร์ก่อน — การ์ดบอกวิธีเตรียมของให้ครบ */}
      {PARTNER_GROUPS.map((g) => (
        <div key={g.title}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            {g.title}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {g.items.map((it) => (
              <PartnerCard key={it.name} info={it} />
            ))}
          </div>
        </div>
      ))}

      <p className="text-xs text-[var(--muted)]">
        * ช่องทางที่ติด &ldquo;ต้องมีบัญชีพาร์ทเนอร์&rdquo; ต้องสมัคร/ทำสัญญากับผู้ให้บริการก่อน
        — กด &ldquo;ดูวิธีเชื่อมต่อ&rdquo; เพื่อดูขั้นตอนเตรียมของ
      </p>
    </div>
  );
}
