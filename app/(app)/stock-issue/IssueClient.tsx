"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { issueStock } from "./actions";

type ProductLite = { id: string; name: string; unit: string; qty: number };
type RecentIssue = {
  id: string;
  qty_change: number;
  note: string | null;
  created_at: string;
  product_name: string | null;
};

const REASONS = ["ของเสีย", "สูญหาย", "เบิกใช้ภายใน", "ตัวอย่าง/แจก", "อื่นๆ"];

export default function IssueClient({
  products,
  recent,
}: {
  products: ProductLite[];
  recent: RecentIssue[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setOk(false);
    start(async () => {
      const res = await issueStock(new FormData(form));
      if (!res.ok) setError(res.error ?? "บันทึกไม่สำเร็จ");
      else {
        setOk(true);
        form.reset(); // ล้างเฉพาะตอนสำเร็จ; ถ้า error ค่าที่กรอกยังอยู่
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">เบิก / ตัดจ่าย</h1>

      <div className="card p-5">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">สินค้า *</label>
              <select name="product_id" required className="input">
                <option value="">เลือกสินค้า...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (เหลือ {p.qty} {p.unit})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">จำนวนที่ตัดออก *</label>
              <input name="qty" type="number" min={1} required className="input" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">เหตุผล</label>
              <select name="reason_label" className="input" defaultValue="เบิกใช้ภายใน">
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">หมายเหตุ</label>
              <input name="note" className="input" />
            </div>
          </div>
          <button disabled={pending} className="btn-primary">
            {pending ? "กำลังบันทึก..." : "ตัดสต็อกออก"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {ok && <p className="text-sm text-green-600">✅ ตัดสต็อกเรียบร้อย</p>}
        </form>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold">รายการตัดจ่ายล่าสุด</h2>
        <div className="mt-3 space-y-2">
          {recent.length === 0 && (
            <p className="text-sm text-[var(--muted)]">ยังไม่มีรายการ</p>
          )}
          {recent.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium">{r.product_name || "—"}</span>
                <span className="text-[var(--muted)]"> · {r.note || "—"}</span>
                <div className="text-xs text-[var(--muted)]">
                  {formatDateTime(r.created_at)}
                </div>
              </div>
              <span className="font-medium text-red-600">{r.qty_change}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
