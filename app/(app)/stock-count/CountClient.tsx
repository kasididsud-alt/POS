"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyCount } from "./actions";

type ProductLite = { id: string; name: string; unit: string; qty: number };

export default function CountClient({ products }: { products: ProductLite[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const changed = products.filter((p) => {
    const v = counts[p.id];
    return v !== undefined && v !== "" && Math.round(Number(v)) !== p.qty;
  });

  function submit() {
    setMsg(null);
    const lines = Object.entries(counts)
      .filter(([, v]) => v !== "" && !Number.isNaN(Number(v)))
      .map(([product_id, v]) => ({ product_id, counted: Number(v) }));
    if (!lines.length) {
      setMsg({ ok: false, text: "ยังไม่ได้กรอกยอดนับ" });
      return;
    }
    start(async () => {
      const res = await applyCount(lines);
      if (!res.ok) setMsg({ ok: false, text: res.error ?? "ผิดพลาด" });
      else {
        setMsg({ ok: true, text: `ปรับยอดแล้ว ${res.adjusted} รายการ` });
        setCounts({});
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ตรวจนับสต็อก</h1>
          <p className="text-sm text-[var(--muted)]">
            กรอกยอดนับจริง ระบบจะปรับส่วนต่างให้อัตโนมัติ
          </p>
        </div>
        <button
          onClick={submit}
          disabled={pending || changed.length === 0}
          className="btn-primary"
        >
          {pending ? "กำลังบันทึก..." : `ปรับยอด (${changed.length})`}
        </button>
      </div>

      {msg && (
        <div
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">สินค้า</th>
              <th className="px-4 py-3 text-right">ยอดระบบ</th>
              <th className="px-4 py-3 text-right">ยอดนับจริง</th>
              <th className="px-4 py-3 text-right">ส่วนต่าง</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const v = counts[p.id];
              const counted = v === undefined || v === "" ? null : Math.round(Number(v));
              const diff = counted === null ? null : counted - p.qty;
              return (
                <tr key={p.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-right text-[var(--muted)]">
                    {p.qty} {p.unit}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      className="w-24 rounded border border-[var(--border)] px-2 py-1 text-right"
                      value={v ?? ""}
                      placeholder={String(p.qty)}
                      onChange={(e) =>
                        setCounts((c) => ({ ...c, [p.id]: e.target.value }))
                      }
                    />
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${
                      diff === null || diff === 0
                        ? "text-[var(--muted)]"
                        : diff > 0
                          ? "text-green-600"
                          : "text-red-600"
                    }`}
                  >
                    {diff === null ? "—" : diff > 0 ? `+${diff}` : diff}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
