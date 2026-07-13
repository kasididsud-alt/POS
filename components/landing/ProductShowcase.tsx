import LandingIcon from "./LandingIcon";

const BENEFITS = [
  {
    title: "สแกนบาร์โค้ดแล้วขายได้เลย",
    description: "ค้นหาสินค้าไว ลดการคีย์ราคาและจำนวนผิดหน้าร้าน",
  },
  {
    title: "รับเงินสดหรือพร้อมเพย์",
    description: "ยอดชำระชัด พร้อมสร้าง QR ตามยอดในบิล",
  },
  {
    title: "ตัดสต็อกให้อัตโนมัติ",
    description: "ทุกบิลอัปเดตจำนวนคงเหลือทันที ไม่ต้องลงซ้ำ",
  },
] as const;

const PRODUCTS = [
  {
    name: "น้ำดื่ม 600 มล.",
    price: "฿10",
    mark: "H₂O",
    markClass: "bg-[var(--lp-blue)] text-[var(--lp-night)]",
  },
  {
    name: "สบู่สมุนไพร",
    price: "฿45",
    mark: "SOAP",
    markClass: "bg-[var(--lp-mint)] text-[var(--lp-mint-ink)]",
  },
  {
    name: "ถ่านอัลคาไลน์ AA",
    price: "฿65",
    mark: "AA",
    markClass: "bg-[var(--lp-night-soft)] text-white",
  },
  {
    name: "กระดาษทิชชู่ 6 ม้วน",
    price: "฿79",
    mark: "6×",
    markClass: "bg-[var(--lp-blue)] text-[var(--lp-night)]",
  },
  {
    name: "ปากกาลูกลื่น",
    price: "฿12",
    mark: "0.5",
    markClass: "bg-[var(--lp-night-soft)] text-white",
  },
  {
    name: "น้ำยาล้างจาน",
    price: "฿35",
    mark: "500",
    markClass: "bg-[var(--lp-mint)] text-[var(--lp-mint-ink)]",
  },
] as const;

const CART_ITEMS = [
  { name: "น้ำดื่ม 600 มล.", quantity: "2 ชิ้น", total: "฿20" },
  { name: "สบู่สมุนไพร", quantity: "1 ชิ้น", total: "฿45" },
  { name: "ถ่านอัลคาไลน์ AA", quantity: "2 ชิ้น", total: "฿130" },
] as const;

export default function ProductShowcase() {
  return (
    <section
      id="product"
      aria-labelledby="product-showcase-title"
      className="border-y border-[var(--lp-rule)] bg-[var(--lp-surface)]"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.48fr)] lg:gap-16 lg:px-8 lg:py-28">
        <div className="max-w-xl">
          <span className="lp-eyebrow">ระบบจริงที่หน้าร้าน</span>
          <h2
            id="product-showcase-title"
            className="lp-display mt-4 text-4xl font-bold leading-tight tracking-[-0.025em] text-[var(--lp-ink)] sm:text-5xl"
          >
            คิดเงินไว ทุกอย่างอัปเดตต่อให้เอง
          </h2>
          <p className="mt-5 max-w-lg text-base leading-8 text-[var(--lp-muted)] sm:text-lg">
            หน้าขายที่พนักงานเรียนรู้ได้เร็ว ตั้งแต่หยิบสินค้าเข้าบิล
            รับชำระ ไปจนถึงอัปเดตของคงเหลือหลังการขาย
          </p>

          <ul className="mt-8 space-y-4" aria-label="จุดเด่นของระบบขายหน้าร้าน">
            {BENEFITS.map((benefit) => (
              <li key={benefit.title} className="flex items-start gap-4">
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--lp-mint)] text-[var(--lp-mint-ink)]">
                  <LandingIcon name="check" className="h-5 w-5" />
                </span>
                <span>
                  <strong className="block text-base font-bold text-[var(--lp-ink)]">
                    {benefit.title}
                  </strong>
                  <span className="mt-1 block text-base leading-7 text-[var(--lp-muted)]">
                    {benefit.description}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <article
          aria-label="ตัวอย่างหน้าจอระบบขายหน้าร้าน"
          className="relative overflow-hidden rounded-[28px] border border-[var(--lp-rule)] bg-[var(--lp-canvas)] shadow-[0_34px_80px_-44px_rgba(7,24,47,0.5)]"
        >
          <header className="flex min-h-14 items-center justify-between gap-4 border-b border-white/10 bg-[var(--lp-night)] px-4 text-white sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex gap-1.5" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--lp-mint)]" />
              </span>
              <span className="truncate text-sm font-bold">ขายดี Stock</span>
            </div>
            <span className="lp-mono rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/75">
              สาขาหลัก · บิล #088
            </span>
          </header>

          <div className="relative grid gap-0 pb-24 md:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]">
            <div className="border-b border-[var(--lp-rule)] p-4 sm:p-5 md:border-b-0 md:border-r">
              <div
                className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--lp-rule)] bg-white px-3.5 text-sm text-[var(--lp-muted)]"
                aria-label="ตัวอย่างช่องค้นหาสินค้า"
              >
                <LandingIcon name="scan" className="h-5 w-5 text-[var(--green)]" />
                <span>สแกนบาร์โค้ด หรือค้นหาชื่อสินค้า</span>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-[var(--lp-ink)]">สินค้าขายดี</h3>
                <span className="lp-mono text-[11px] text-[var(--lp-muted)]">
                  6 รายการ
                </span>
              </div>

              <ul
                className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-2 xl:grid-cols-3"
                aria-label="สินค้าขายดี"
              >
                {PRODUCTS.map((product) => (
                  <li
                    key={product.name}
                    className="min-h-32 rounded-2xl border border-[var(--lp-rule)] bg-white p-3 text-left"
                  >
                    <span
                      className={`lp-mono grid h-12 w-full place-items-center rounded-xl text-xs font-black tracking-[0.08em] ${product.markClass}`}
                      aria-hidden="true"
                    >
                      {product.mark}
                    </span>
                    <span className="mt-2.5 block text-xs font-semibold leading-5 text-[var(--lp-ink)]">
                      {product.name}
                    </span>
                    <span className="lp-mono mt-1 block text-sm font-bold text-[var(--green)]">
                      {product.price}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <aside className="bg-white p-4 sm:p-5" aria-labelledby="demo-cart-title">
              <div className="flex items-center justify-between gap-3">
                <h3 id="demo-cart-title" className="text-sm font-bold text-[var(--lp-ink)]">
                  ตะกร้าสินค้า
                </h3>
                <span className="lp-mono rounded-full bg-[var(--paper-2)] px-2.5 py-1 text-[11px] font-bold text-[var(--green-d)]">
                  5 ชิ้น
                </span>
              </div>

              <ul className="mt-4 divide-y divide-[var(--lp-rule)]">
                {CART_ITEMS.map((item) => (
                  <li key={item.name} className="grid grid-cols-[1fr_auto] gap-3 py-3 first:pt-0">
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold leading-5 text-[var(--lp-ink)]">
                        {item.name}
                      </span>
                      <span className="lp-mono mt-0.5 block text-[11px] text-[var(--lp-muted)]">
                        {item.quantity}
                      </span>
                    </span>
                    <strong className="lp-mono text-xs text-[var(--lp-ink)]">
                      {item.total}
                    </strong>
                  </li>
                ))}
              </ul>

              <dl className="mt-2 space-y-2 border-t border-dashed border-[var(--lp-rule)] pt-4 text-xs">
                <div className="flex items-center justify-between gap-3 text-[var(--lp-muted)]">
                  <dt>ยอดรวมสินค้า</dt>
                  <dd className="lp-mono">฿195</dd>
                </div>
                <div className="flex items-center justify-between gap-3 text-[var(--green)]">
                  <dt>ส่วนลดท้ายบิล</dt>
                  <dd className="lp-mono">−฿20</dd>
                </div>
                <div className="flex items-end justify-between gap-3 border-t border-[var(--lp-rule)] pt-3 text-[var(--lp-ink)]">
                  <dt className="font-bold">ยอดสุทธิ</dt>
                  <dd className="lp-mono text-2xl font-black">฿175</dd>
                </div>
              </dl>

              <div className="mt-4">
                <p className="text-[11px] font-semibold text-[var(--lp-muted)]">
                  วิธีชำระเงิน
                </p>
                <ul
                  className="mt-2 grid grid-cols-2 gap-2"
                  aria-label="วิธีชำระเงิน"
                >
                  <li className="grid min-h-11 place-items-center rounded-xl border border-[var(--lp-rule)] bg-white px-3 text-xs font-bold text-[var(--lp-ink)]">
                    เงินสด
                  </li>
                  <li className="grid min-h-11 place-items-center rounded-xl border border-[var(--green-d)] bg-[var(--paper-2)] px-3 text-xs font-bold text-[var(--green-d)]">
                    พร้อมเพย์
                  </li>
                </ul>
              </div>

              <p className="mt-3 grid min-h-12 w-full place-items-center rounded-xl bg-[var(--green)] px-4 text-sm font-black text-white shadow-[0_14px_28px_-18px_rgba(8,127,96,0.8)]">
                เก็บเงิน ฿175
              </p>
            </aside>

            <div className="absolute bottom-4 left-4 flex items-center gap-3 rounded-2xl border border-[var(--lp-rule)] bg-white px-3.5 py-3 shadow-[0_18px_42px_-24px_rgba(7,24,47,0.48)] sm:left-5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--lp-mint)] text-[var(--lp-mint-ink)]">
                <LandingIcon name="check" className="h-5 w-5" />
              </span>
              <span>
                <strong className="block text-xs font-bold text-[var(--lp-ink)]">
                  สต็อกตัดแล้ว
                </strong>
                <span className="lp-mono mt-0.5 block text-[10px] text-[var(--lp-muted)]">
                  3 รายการ · อัปเดตทันที
                </span>
              </span>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
