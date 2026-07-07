import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/auth";
import { getProductsWithStock } from "@/lib/queries";

function AlertList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "red" | "amber";
  items: { id: string; name: string; qty: number; unit: string }[];
}) {
  const color = tone === "red" ? "text-red-700 bg-red-50" : "text-amber-700 bg-amber-50";
  return (
    <div className="card p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        {title}
        <span className={`rounded-full px-2 py-0.5 text-xs ${color}`}>
          {items.length}
        </span>
      </h2>
      <div className="mt-3 space-y-2">
        {items.length === 0 && (
          <p className="text-sm text-[var(--muted)]">ไม่มีรายการ 🎉</p>
        )}
        {items.map((p) => (
          <Link
            key={p.id}
            href={`/stock/${p.id}`}
            className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
          >
            <span>{p.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${color}`}>
              เหลือ {p.qty} {p.unit}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function AlertsPage() {
  const ctx = await getAppContext();
  if (!ctx?.org) redirect("/onboarding");

  const products = await getProductsWithStock(ctx.org.id, ctx.branchId, { activeOnly: true });
  const out = products.filter((p) => p.qty <= 0);
  const low = products.filter(
    (p) => p.qty > 0 && p.qty <= p.low_stock_threshold,
  );

  const parts: string[] = [];
  if (out.length > 0) parts.push(`สินค้าหมด ${out.length} รายการ`);
  if (low.length > 0) parts.push(`สินค้าใกล้หมด ${low.length} รายการ`);
  const names = [...out, ...low].map((p) => p.name);
  const preview = names.slice(0, 3).join(", ");
  const more = names.length > 3 ? ` และอีก ${names.length - 3} รายการ` : "";

  const branchName =
    ctx.branches.length > 1
      ? ctx.branches.find((b) => b.id === ctx.branchId)?.name
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ศูนย์แจ้งเตือน</h1>
        <p className="text-sm text-[var(--muted)]">
          รวมเรื่องที่ต้องจัดการเกี่ยวกับสต็อก
          {branchName && <> · คงคลังสาขา <span className="font-medium">{branchName}</span></>}
        </p>
      </div>

      {parts.length > 0 && (
        <div className="card flex items-start gap-3 border-l-4 border-red-500 bg-red-50/60 p-4">
          <span className="text-xl">🔔</span>
          <div className="text-sm">
            <p className="font-semibold text-red-800">
              มีรายการที่ต้องจัดการ {out.length + low.length} รายการ
              {" — "}
              {parts.join(" และ ")}
            </p>
            <p className="mt-0.5 text-[var(--muted)]">
              ได้แก่ {preview}
              {more}
            </p>
          </div>
        </div>
      )}

      {out.length === 0 && low.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl">✅</div>
          <p className="mt-3 text-sm text-[var(--muted)]">
            ทุกอย่างเรียบร้อย ไม่มีสินค้าที่ต้องเติม
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <AlertList title="สินค้าหมด" tone="red" items={out} />
          <AlertList title="สินค้าใกล้หมด" tone="amber" items={low} />
        </div>
      )}
    </div>
  );
}
