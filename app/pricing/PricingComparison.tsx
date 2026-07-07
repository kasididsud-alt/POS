type Cell = boolean | string;
type Row = { label: string; vals: [Cell, Cell, Cell, Cell] };
type Section = { title: string; rows: Row[] };

const TIERS = [
  { name: "เริ่มต้น", price: "ฟรี", sub: "" },
  { name: "ร้านค้า", price: "฿399", sub: "/เดือน", highlight: true },
  { name: "มืออาชีพ", price: "฿990", sub: "/เดือน" },
  { name: "องค์กรใหญ่", price: "ติดต่อเรา", sub: "" },
];

const SECTIONS: Section[] = [
  {
    title: "ขีดจำกัด",
    rows: [
      { label: "จำนวนสินค้า", vals: ["80", "500", "5,000", "ไม่จำกัด"] },
      { label: "สาขา", vals: ["1", "1", "ไม่จำกัด", "ไม่จำกัด"] },
      { label: "ผู้ใช้ (พนักงาน)", vals: ["1", "ถึง 5", "ไม่จำกัด", "ไม่จำกัด"] },
      { label: "จำนวนบิล", vals: ["ไม่จำกัด", "ไม่จำกัด", "ไม่จำกัด", "ไม่จำกัด"] },
    ],
  },
  {
    title: "ขายหน้าร้าน & POS",
    rows: [
      { label: "ขาย POS + ตัดสต็อกอัตโนมัติ", vals: [true, true, true, true] },
      { label: "รับเงินสด + พร้อมเพย์", vals: [true, true, true, true] },
      { label: "สแกนบาร์โค้ด + พิมพ์ใบเสร็จ", vals: [true, true, true, true] },
      { label: "ประวัติการขาย + คืนสินค้า", vals: [true, true, true, true] },
      { label: "ปิดยอด / นับเงินลิ้นชัก (กะขาย)", vals: [true, true, true, true] },
    ],
  },
  {
    title: "พนักงาน · ลูกค้า · รายงาน",
    rows: [
      { label: "พนักงานหลายคน + แยกสิทธิ์", vals: [false, true, true, true] },
      { label: "ลูกค้า + สมาชิก + สะสมแต้ม", vals: [false, true, true, true] },
      { label: "โปรโมชั่น / ส่วนลด", vals: [false, true, true, true] },
      { label: "รายงานเต็ม + กำไรจากต้นทุนจริง", vals: ["พื้นฐาน", true, true, true] },
      { label: "พิมพ์ฉลาก / บาร์โค้ดสินค้า", vals: [false, true, true, true] },
      { label: "แจ้งเตือนสินค้าใกล้หมด", vals: [false, true, true, true] },
    ],
  },
  {
    title: "คลัง · จัดซื้อ",
    rows: [
      { label: "หลายสาขา + โอนย้ายสต็อก", vals: [false, false, true, true] },
      { label: "ตรวจนับ + ตำแหน่งจัดเก็บ", vals: [false, false, true, true] },
      { label: "ล็อตสินค้า + วันหมดอายุ", vals: [false, false, true, true] },
      { label: "ใบสั่งซื้อ (PO) + ซัพพลายเออร์", vals: [false, false, true, true] },
      { label: "ขายเชื่อ / ลูกหนี้ + วางบิล", vals: [false, false, true, true] },
      { label: "รายงาน VAT + Export (Excel/CSV)", vals: [false, false, true, true] },
      { label: "สิทธิ์ละเอียด + audit log", vals: [false, false, true, true] },
    ],
  },
  {
    title: "องค์กร (เฉพาะแพ็กใหญ่)",
    rows: [
      { label: "เชื่อมต่อ integrations", vals: [false, false, true, true] },
      { label: "API / Webhook สำหรับนักพัฒนา", vals: [false, false, false, true] },
      { label: "สร้าง Role เอง (custom สิทธิ์)", vals: [false, false, false, true] },
      { label: "ผู้ดูแลเฉพาะ + SLA + อบรม", vals: [false, false, false, true] },
    ],
  },
];

// พื้นไฮไลต์คอลัมน์ Pro (index 1) — ใช้ rgba ตรงๆ กันปัญหา opacity ของ CSS var
const PRO_TINT = "bg-[rgba(14,122,67,0.05)] border-x border-[rgba(14,122,67,0.22)]";
function pro(i: number, extra = ""): string {
  return i === 1 ? `${PRO_TINT} ${extra}` : "";
}

function CellView({ v }: { v: Cell }) {
  if (v === true)
    return (
      <span className="mx-auto inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[rgba(14,122,67,0.12)] text-[12px] font-bold text-[var(--green-d)]">
        ✓
      </span>
    );
  if (v === false) return <span className="text-base text-[var(--rule)]">–</span>;
  const soft = v === "พื้นฐาน" || v === "ถึง 5";
  return (
    <span className={soft ? "text-xs text-[var(--muted2)]" : "font-semibold text-[var(--ink)]"}>
      {v}
    </span>
  );
}

export default function PricingComparison() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky top-0 z-10 w-[34%] bg-white/95 pb-3 text-left align-bottom backdrop-blur" />
            {TIERS.map((t, i) => (
              <th
                key={t.name}
                className={`sticky top-0 z-10 px-4 pb-4 pt-4 text-center align-bottom ${
                  t.highlight
                    ? "rounded-t-xl bg-[var(--green)] text-white"
                    : "bg-white/95 backdrop-blur"
                }`}
              >
                {t.highlight && (
                  <div className="lp-mono mb-1 text-[10px] uppercase tracking-widest text-white/85">
                    ★ ยอดนิยม
                  </div>
                )}
                <div
                  className={`lp-display text-base font-bold ${
                    t.highlight ? "text-white" : "text-[var(--ink)]"
                  }`}
                >
                  {t.name}
                </div>
                <div className="mt-1 leading-none">
                  <span className={`text-xl font-bold ${t.highlight ? "text-white" : "text-[var(--ink)]"}`}>
                    {t.price}
                  </span>
                  {t.sub && (
                    <span className={`ml-1 text-[11px] ${t.highlight ? "text-white/80" : "text-[var(--muted2)]"}`}>
                      {t.sub}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SECTIONS.map((sec) => (
            <SectionRows key={sec.title} sec={sec} />
          ))}
          {/* ปิดท้ายคอลัมน์ Pro ให้มนสวย */}
          <tr>
            <td />
            {TIERS.map((t, i) => (
              <td
                key={t.name}
                className={pro(i, "h-3 rounded-b-xl border-b border-[rgba(14,122,67,0.22)]")}
              />
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SectionRows({ sec }: { sec: Section }) {
  return (
    <>
      <tr>
        <td className="pb-2 pt-7">
          <span className="lp-mono text-xs font-bold uppercase tracking-wider text-[var(--green-d)]">
            {sec.title}
          </span>
        </td>
        {TIERS.map((t, i) => (
          <td key={t.name} className={pro(i)} />
        ))}
      </tr>
      {sec.rows.map((r, ri) => (
        <tr key={r.label} className="group">
          <td
            className={`py-3 pr-4 text-[var(--ink)] ${
              ri % 2 ? "" : "bg-[rgba(24,34,28,0.015)]"
            }`}
          >
            {r.label}
          </td>
          {r.vals.map((v, i) => (
            <td
              key={i}
              className={`px-4 py-3 text-center align-middle ${pro(i)} ${
                ri % 2 || i === 1 ? "" : "bg-[rgba(24,34,28,0.015)]"
              }`}
            >
              <CellView v={v} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
