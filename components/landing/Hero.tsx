import Image from "next/image";
import Link from "next/link";
import LandingIcon from "./LandingIcon";
import LiveTicker from "./LiveTicker";
import LogoMark from "./LogoMark";
import { AuthNavCta, AuthPrimaryCta } from "./AuthCta";

export default function Hero() {

  return (
    <>
      <header className="lp-header">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2.5 rounded-xl"
            aria-label="ขายดี Stock หน้าแรก"
          >
            <LogoMark />
            <span className="text-base font-semibold tracking-tight text-white sm:text-lg">
              ขายดี <span className="text-[var(--lp-mint)]">Stock</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1 text-sm" aria-label="เมนูหลัก">
            <a href="#product" className="lp-nav-link hidden lg:inline-flex">
              ระบบ POS
            </a>
            <a href="#features" className="lp-nav-link hidden lg:inline-flex">
              ฟีเจอร์
            </a>
            <Link href="/pricing" className="lp-nav-link hidden md:inline-flex">
              ราคา
            </Link>
            <AuthNavCta loginClass="lp-nav-link" ctaClass="lp-header-cta" />
          </nav>
        </div>
      </header>

      <section className="lp-hero" aria-labelledby="landing-hero-title">
        <div
          className="lp-hero-media"
          aria-hidden="true"
          style={{ position: "absolute" }}
        >
          <Image
            src="/images/landing/retail-command-center.png"
            alt=""
            fill
            preload
            sizes="100vw"
            className="lp-hero-image object-cover"
          />
          <div className="lp-hero-scrim" />
        </div>

        <div className="lp-hero-content">
          <div className="lp-hero-copy">
            <div className="lp-glass-panel">
              <span className="lp-hero-eyebrow">
                <span aria-hidden="true" />
                ระบบจัดการร้านที่ทำงานแบบสด
              </span>
              <h1 id="landing-hero-title" className="lp-hero-title">
                ขายคล่อง
                <span>สต็อกตรง</span>
                รู้กำไรทุกวัน
              </h1>
              <p className="lp-hero-description">
                POS + คลังสินค้า สำหรับร้านขายของที่อยากทำงานเร็วขึ้น
                ตั้งแต่หน้าร้านจนถึงหลังร้าน จบในระบบเดียว
              </p>
              <div className="lp-hero-actions">
                <AuthPrimaryCta className="lp-btn-primary">
                  <LandingIcon name="arrow" className="h-5 w-5" />
                </AuthPrimaryCta>
                <a href="#product" className="lp-btn-secondary">
                  ดูระบบจริง
                </a>
              </div>
            </div>

            <div className="lp-hero-stats" aria-label="ตัวอย่างข้อมูลจากระบบ">
              <article className="lp-stat-card">
                <span className="lp-stat-label">ยอดขายวันนี้</span>
                <strong className="lp-stat-value">฿12,450</strong>
                <div className="lp-stat-trend">
                  <svg
                    viewBox="0 0 88 28"
                    className="lp-stat-sparkline"
                    aria-hidden="true"
                  >
                    <polyline points="1,23 15,17 29,19 44,9 58,13 72,5 87,7" />
                  </svg>
                  <span>+18%</span>
                </div>
              </article>

              <article className="lp-stat-card lp-stat-card-bill">
                <span className="lp-stat-label">บิลล่าสุด</span>
                <strong className="lp-stat-value">#087</strong>
                <span className="lp-stat-detail">พร้อมเพย์ · ฿245</span>
              </article>

              <article className="lp-stat-card">
                <span className="lp-stat-label">สต็อกใกล้หมด</span>
                <strong className="lp-stat-value">4 รายการ</strong>
                <span className="lp-stat-detail">
                  <LandingIcon name="alert" className="h-4 w-4" />
                  พร้อมเติมสต็อก
                </span>
              </article>
            </div>
          </div>
        </div>

        <LiveTicker />
      </section>
    </>
  );
}
