import { requireOwnerPage } from "@/lib/guard";
import { query } from "@/lib/db";
import ApiKeysClient from "./ApiKeysClient";

const GROUPS = [
  {
    title: "ช่องทางขายออนไลน์",
    items: [
      { icon: "🛒", name: "Shopee", desc: "ดึงออเดอร์ + ซิงค์สต็อก" },
      { icon: "🛍️", name: "Lazada", desc: "ดึงออเดอร์ + ซิงค์สต็อก" },
      { icon: "🎵", name: "TikTok Shop", desc: "ดึงออเดอร์ + ซิงค์สต็อก" },
      { icon: "💬", name: "LINE Shopping", desc: "รับออเดอร์ผ่าน LINE" },
    ],
  },
  {
    title: "ขนส่ง",
    items: [
      { icon: "📦", name: "Flash Express", desc: "พิมพ์ใบปะหน้า + ติดตามพัสดุ" },
      { icon: "🚚", name: "Kerry / J&T", desc: "สร้างเลขพัสดุ + COD" },
    ],
  },
  {
    title: "บัญชี & การเงิน",
    items: [
      { icon: "🧾", name: "FlowAccount / PEAK", desc: "ส่งออกยอดขายเข้าระบบบัญชี" },
      { icon: "💳", name: "Omise / Stripe", desc: "รับบัตรเครดิต + e-wallet" },
    ],
  },
  {
    title: "สื่อสารกับลูกค้า",
    items: [
      { icon: "📣", name: "LINE Official Account", desc: "ส่งโปรโมชั่น + ใบเสร็จ" },
      { icon: "✉️", name: "SMS", desc: "แจ้งสถานะออเดอร์" },
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">การเชื่อมต่อ</h1>
        <p className="text-sm text-[var(--muted)]">
          เชื่อมต่อผ่าน API ของเรา หรือช่องทางขาย/ขนส่ง/บัญชีภายนอก
        </p>
      </div>

      <ApiKeysClient keys={keys} />

      {GROUPS.map((g) => (
        <div key={g.title}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            {g.title}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {g.items.map((it) => (
              <div key={it.name} className="card flex items-center gap-4 p-4">
                <div className="text-3xl">{it.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{it.name}</div>
                  <div className="text-xs text-[var(--muted)]">{it.desc}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    ยังไม่เชื่อมต่อ
                  </span>
                  <button
                    disabled
                    className="btn-outline px-3 py-1 text-xs opacity-60"
                    title="ต้องตั้งค่า API key — เปิดให้บริการเร็วๆ นี้"
                  >
                    เชื่อมต่อ
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="text-xs text-[var(--muted)]">
        * การเชื่อมต่อจริงต้องมี API key/สิทธิ์จากแต่ละบริการ — โครงพร้อมแล้ว
        รอเปิดใช้งานทีละช่องทาง
      </p>
    </div>
  );
}
