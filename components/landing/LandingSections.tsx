import Link from "next/link";
import LandingIcon from "./LandingIcon";
import LogoMark from "./LogoMark";
import {
  FAQ_ITEMS,
  FEATURES,
  OUTCOMES,
  STORE_TYPES,
  WORKFLOW_STEPS,
} from "./content";

export function Outcomes() {
  return (
    <section
      aria-labelledby="outcomes-title"
      className="bg-[var(--lp-canvas)] py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <span className="lp-eyebrow">ผลลัพธ์ที่ร้านเห็นทุกวัน</span>
          <h2
            id="outcomes-title"
            className="lp-display mt-4 text-4xl font-bold leading-tight tracking-[-0.025em] text-[var(--lp-ink)] sm:text-5xl"
          >
            งานหน้าร้านเร็วขึ้น ข้อมูลหลังร้านตรงขึ้น
          </h2>
          <p className="mt-5 max-w-[68ch] text-base leading-8 text-[var(--lp-muted)] sm:text-lg">
            ทุกการขายเชื่อมกับสินค้าและรายงานโดยตรง
            เจ้าของร้านจึงเห็นภาพจริงโดยไม่ต้องลงข้อมูลซ้ำ
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3 lg:mt-12">
          {OUTCOMES.map((outcome) => (
            <article key={outcome.id} className="lp-card h-full p-6 sm:p-7">
              <span className="lp-chip lp-chip-lg" aria-hidden="true">
                <LandingIcon name={outcome.icon} className="h-7 w-7" />
              </span>
              <h3 className="mt-6 text-xl font-bold text-[var(--lp-ink)]">
                {outcome.title}
              </h3>
              <p className="mt-3 max-w-[68ch] text-base leading-7 text-[var(--lp-muted)]">
                {outcome.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RetailWorkflow() {
  return (
    <section
      aria-labelledby="workflow-title"
      className="border-y border-[var(--lp-rule)] bg-[var(--lp-surface)] py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="lp-eyebrow">จากตั้งร้านถึงปิดยอด</span>
          <h2
            id="workflow-title"
            className="lp-display mt-4 text-4xl font-bold leading-tight tracking-[-0.025em] text-[var(--lp-ink)] sm:text-5xl"
          >
            ขั้นตอนเดียวกันตั้งแต่สินค้าเข้าจนขายออก
          </h2>
          <p className="mx-auto mt-5 max-w-[68ch] text-base leading-8 text-[var(--lp-muted)] sm:text-lg">
            เริ่มจากข้อมูลสินค้าที่ร้านมีอยู่ แล้วปล่อยให้ทุกบิลอัปเดตสต็อก
            ต้นทุน และรายงานต่อกันเป็นลำดับ
          </p>
        </div>

        <ol className="relative mt-12 grid gap-6 lg:grid-cols-4 lg:gap-8 lg:before:absolute lg:before:left-[12.5%] lg:before:right-[12.5%] lg:before:top-7 lg:before:h-px lg:before:bg-[var(--lp-rule)]">
          {WORKFLOW_STEPS.map((item) => (
            <li key={item.id} className="relative">
              <article className="h-full rounded-2xl border border-[var(--lp-rule)] bg-[var(--lp-canvas)] p-6 lg:border-0 lg:bg-transparent lg:px-2 lg:pb-0 lg:pt-0 lg:text-center">
                <span className="lp-mono relative z-10 inline-grid h-14 w-14 place-items-center rounded-2xl bg-[var(--lp-night)] text-base font-black text-[var(--lp-mint)] shadow-[0_14px_32px_-20px_rgba(7,24,47,0.7)]">
                  {item.step}
                </span>
                <h3 className="mt-5 text-xl font-bold text-[var(--lp-ink)]">
                  {item.title}
                </h3>
                <p className="mx-auto mt-3 max-w-[68ch] text-base leading-7 text-[var(--lp-muted)]">
                  {item.description}
                </p>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function FeatureGrid() {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="bg-[var(--lp-canvas)] py-16 sm:py-20 lg:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <span className="lp-eyebrow">เครื่องมือสำหรับร้านขายสินค้า</span>
          <h2
            id="features-title"
            className="lp-display mt-4 text-4xl font-bold leading-tight tracking-[-0.025em] text-[var(--lp-ink)] sm:text-5xl"
          >
            ฟีเจอร์ที่เชื่อมหน้าร้านกับคลังจริง
          </h2>
          <p className="mt-5 max-w-[68ch] text-base leading-8 text-[var(--lp-muted)] sm:text-lg">
            ตั้งแต่รับสินค้า ขาย โอนสาขา ไปจนถึงติดตามลูกหนี้
            ทุกส่วนใช้ข้อมูลชุดเดียวกันและตรวจสอบย้อนหลังได้
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:mt-12 lg:grid-cols-4">
          {FEATURES.map((feature) => {
            const isWide = feature.id === "inventory" || feature.id === "reports";

            return (
              <article
                key={feature.id}
                className={`lp-card min-h-64 overflow-hidden p-6 sm:p-7 ${
                  isWide ? "lg:col-span-2" : ""
                }`}
              >
                <div
                  className={`flex h-full gap-6 ${
                    isWide
                      ? "flex-col justify-between sm:flex-row sm:items-end"
                      : "flex-col"
                  }`}
                >
                  <span className="lp-chip lp-chip-lg shrink-0" aria-hidden="true">
                    <LandingIcon name={feature.icon} className="h-7 w-7" />
                  </span>
                  <div className={isWide ? "max-w-xl" : "mt-auto"}>
                    <h3 className="text-xl font-bold text-[var(--lp-ink)] sm:text-2xl">
                      {feature.title}
                    </h3>
                    <p className="mt-3 max-w-[68ch] text-base leading-7 text-[var(--lp-muted)]">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function StoreFit() {
  return (
    <section
      aria-labelledby="store-fit-title"
      className="border-y border-[var(--lp-rule)] bg-[var(--lp-surface)] py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="lp-eyebrow">เหมาะกับร้านที่มีสินค้าในสต็อก</span>
          <h2
            id="store-fit-title"
            className="lp-display mt-4 text-4xl font-bold leading-tight tracking-[-0.025em] text-[var(--lp-ink)] sm:text-5xl"
          >
            ปรับใช้กับรูปแบบร้านค้าปลีกและขายส่งได้
          </h2>
          <p className="mx-auto mt-5 max-w-[68ch] text-base leading-8 text-[var(--lp-muted)] sm:text-lg">
            เลือกใช้ฟีเจอร์ตามวิธีขายและการจัดเก็บของร้าน
            โดยไม่ต้องเปลี่ยนระบบเป็นคนละชุดเมื่อสินค้าเพิ่มขึ้น
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-12 lg:grid-cols-4">
          {STORE_TYPES.map((store) => (
            <article
              key={store.id}
              className="relative overflow-hidden rounded-2xl border border-[var(--lp-rule)] bg-[var(--lp-canvas)] p-6 sm:p-7"
            >
              <span
                className="absolute inset-x-0 top-0 h-1 bg-[var(--lp-blue)]"
                aria-hidden="true"
              />
              <span className="text-base font-bold text-[var(--green-d)]">
                เหมาะกับ
              </span>
              <h3 className="mt-4 text-2xl font-bold text-[var(--lp-ink)]">
                {store.title}
              </h3>
              <p className="mt-3 max-w-[68ch] text-base leading-7 text-[var(--lp-muted)]">
                {store.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingFaq() {
  return (
    <section
      aria-labelledby="landing-faq-title"
      className="bg-[var(--lp-canvas)] py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-16 lg:px-8">
        <div className="max-w-xl">
          <span className="lp-eyebrow">คำถามก่อนเริ่มใช้งาน</span>
          <h2
            id="landing-faq-title"
            className="lp-display mt-4 text-4xl font-bold leading-tight tracking-[-0.025em] text-[var(--lp-ink)] sm:text-5xl"
          >
            เรื่องที่เจ้าของร้านควรรู้
          </h2>
          <p className="mt-5 max-w-[68ch] text-base leading-8 text-[var(--lp-muted)] sm:text-lg">
            คำตอบสั้น ๆ เรื่องแพ็กเกจ อุปกรณ์ การรับชำระ
            และการแยกข้อมูลของแต่ละร้าน
          </p>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.id}
              className="group rounded-2xl border border-[var(--lp-rule)] bg-[var(--lp-surface)] px-5 open:shadow-[0_20px_50px_-36px_rgba(7,24,47,0.45)] sm:px-6"
            >
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 rounded-xl py-4 text-base font-bold text-[var(--lp-ink)] [&::-webkit-details-marker]:hidden">
                <span>{item.question}</span>
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--paper-2)] text-[var(--green-d)]"
                  aria-hidden="true"
                >
                  <LandingIcon
                    name="arrow"
                    className="h-5 w-5 transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none"
                  />
                </span>
              </summary>
              <p className="max-w-[68ch] border-t border-[var(--lp-rule)] py-5 text-base leading-8 text-[var(--lp-muted)]">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ClosingCta({
  isAuthed,
}: Readonly<{ isAuthed: boolean }>) {
  const primaryHref = isAuthed ? "/dashboard" : "/signup";
  const primaryLabel = isAuthed ? "ไปที่แดชบอร์ด" : "เริ่มใช้ฟรี";

  return (
    <section
      aria-labelledby="closing-cta-title"
      className="border-t border-[var(--lp-rule)] bg-[var(--lp-surface)] py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[28px] bg-[var(--lp-night)] px-6 py-12 text-white shadow-[0_36px_80px_-46px_rgba(6,21,43,0.78)] sm:px-10 sm:py-14 lg:px-16 lg:py-16">
          <div
            className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[var(--lp-blue)]/15 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-[var(--lp-mint)]/10 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="text-base font-bold text-[var(--lp-mint)]">
                พร้อมจัดการร้านจากข้อมูลจริงแล้วหรือยัง?
              </span>
              <h2
                id="closing-cta-title"
                className="lp-display mt-4 text-4xl font-bold leading-tight tracking-[-0.025em] text-white sm:text-5xl"
              >
                เริ่มขายให้คล่อง แล้วปล่อยให้สต็อกตามทุกบิล
              </h2>
              <p className="mt-5 max-w-[68ch] text-base leading-8 text-white/75 sm:text-lg">
                เริ่มจากแพ็กฟรีโดยไม่ต้องใช้บัตรเครดิต
                แล้วเลือกแพ็กที่เหมาะเมื่อร้านต้องการฟีเจอร์เพิ่ม
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link
                href={primaryHref}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--lp-mint)] px-6 py-3 text-base font-bold text-[var(--lp-night)] transition-[transform,opacity] duration-200 hover:-translate-y-0.5 hover:opacity-95"
              >
                {primaryLabel}
                <LandingIcon name="arrow" className="h-5 w-5" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/40 px-6 py-3 text-base font-bold text-white transition-opacity duration-200 hover:opacity-80"
              >
                ดูราคา
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      aria-labelledby="landing-footer-title"
      className="border-t border-white/10 bg-[var(--lp-night)] py-16 text-white lg:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 border-b border-white/10 pb-12 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,0.6fr))]">
          <div className="max-w-md">
            <div className="flex items-center gap-3">
              <LogoMark className="h-11 w-11" />
              <h2 id="landing-footer-title" className="text-xl font-bold">
                ขายดี <span className="text-[var(--lp-mint)]">Stock</span>
              </h2>
            </div>
            <p className="mt-5 max-w-[68ch] text-base leading-8 text-white/70">
              ระบบ POS และคลังสินค้าสำหรับร้านขายสินค้าไทย
              ช่วยให้ทุกบิลเชื่อมกับสต็อกและรายงานในที่เดียว
            </p>
          </div>

          <nav aria-label="ลิงก์ผลิตภัณฑ์">
            <h3 className="text-base font-bold text-white">ผลิตภัณฑ์</h3>
            <div className="mt-4 flex flex-col items-start gap-2">
              <a
                href="#product"
                className="inline-flex min-h-11 min-w-11 items-center py-2 text-base text-white/70 transition-opacity duration-200 hover:opacity-80"
              >
                ระบบ POS
              </a>
              <a
                href="#features"
                className="inline-flex min-h-11 min-w-11 items-center py-2 text-base text-white/70 transition-opacity duration-200 hover:opacity-80"
              >
                ฟีเจอร์
              </a>
              <Link
                href="/pricing"
                className="inline-flex min-h-11 min-w-11 items-center py-2 text-base text-white/70 transition-opacity duration-200 hover:opacity-80"
              >
                ราคา
              </Link>
            </div>
          </nav>

          <nav aria-label="ลิงก์นโยบาย">
            <h3 className="text-base font-bold text-white">นโยบาย</h3>
            <div className="mt-4 flex flex-col items-start gap-2">
              <Link
                href="/privacy"
                className="inline-flex min-h-11 min-w-11 items-center py-2 text-base text-white/70 transition-opacity duration-200 hover:opacity-80"
              >
                ความเป็นส่วนตัว
              </Link>
              <Link
                href="/terms"
                className="inline-flex min-h-11 min-w-11 items-center py-2 text-base text-white/70 transition-opacity duration-200 hover:opacity-80"
              >
                ข้อกำหนดการใช้งาน
              </Link>
            </div>
          </nav>
        </div>

        <p className="pt-8 text-base text-white/60">
          © {currentYear} ขายดี Stock สงวนลิขสิทธิ์
        </p>
      </div>
    </footer>
  );
}
