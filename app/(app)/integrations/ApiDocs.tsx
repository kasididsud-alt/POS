/** เอกสาร REST API ฉบับย่อ — โชว์ใต้การ์ด API Keys ในหน้า การเชื่อมต่อ */
export default function ApiDocs({ siteUrl }: { siteUrl: string }) {
  const endpoints = [
    {
      method: "GET",
      path: "/api/v1/products",
      desc: "รายการสินค้า + สต็อกรวมทุกสาขา",
      params: "limit (1-500, ค่าเริ่มต้น 100) · offset · q (ค้นหาชื่อ/SKU/บาร์โค้ด)",
    },
    {
      method: "GET",
      path: "/api/v1/stock",
      desc: "สต็อกแยกตามสาขา",
      params: "branch_id · low_stock=true (เฉพาะถึงจุดเตือน) · limit · offset",
    },
  ];

  return (
    <details className="card p-6">
      <summary className="cursor-pointer font-semibold">
        📖 เอกสาร API (ฉบับย่อ)
      </summary>
      <div className="mt-4 space-y-4 text-sm">
        <p className="text-[var(--muted)]">
          ทุกคำขอต้องแนบ header{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            Authorization: Bearer kds_live_xxx
          </code>{" "}
          — จำกัดอัตราตามแพ็กเกจ (เริ่มต้น 120 / ร้านค้า 600 / มืออาชีพ 2,000
          คำขอ/นาที) เกินแล้วได้ 429 พร้อม Retry-After
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border)] text-[var(--muted)]">
              <tr>
                <th className="py-2 pr-3">Endpoint</th>
                <th className="py-2 pr-3">คืนอะไร</th>
                <th className="py-2">พารามิเตอร์</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((e) => (
                <tr key={e.path} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 pr-3 font-mono whitespace-nowrap">
                    <span className="mr-1 rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
                      {e.method}
                    </span>
                    {e.path}
                  </td>
                  <td className="py-2 pr-3">{e.desc}</td>
                  <td className="py-2 text-[var(--muted)]">{e.params}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div className="mb-1 font-medium">ตัวอย่าง</div>
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
            {`curl "${siteUrl}/api/v1/products?limit=50&q=น้ำ" \\
  -H "Authorization: Bearer kds_live_xxx"

curl "${siteUrl}/api/v1/stock?low_stock=true" \\
  -H "Authorization: Bearer kds_live_xxx"`}
          </pre>
        </div>

        <p className="text-xs text-[var(--muted)]">
          ทุก endpoint แบ่งหน้าเหมือนกัน: ส่ง limit/offset แล้วอ่าน{" "}
          <code>next_offset</code> จากคำตอบ (null = หมดแล้ว)
        </p>
      </div>
    </details>
  );
}
