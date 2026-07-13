import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai, Prompt, Chakra_Petch } from "next/font/google";
import "./globals.css";

const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

// ฟอนต์หัวข้อ (ไทย geometric หนักแน่น) สำหรับหน้า landing
const prompt = Prompt({
  variable: "--font-display",
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
});

// ฟอนต์เหลี่ยมสไตล์ป้ายไฟ/ตัวเลข (รองรับไทย) สำหรับตัวเลข ป้ายกำกับ และแถบ LED
const chakra = Chakra_Petch({
  variable: "--font-mono",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ขายดี Stock — ระบบ POS + คลังสินค้า สำหรับร้านค้าไทย",
    template: "%s · ขายดี Stock",
  },
  description:
    "โปรแกรมขายหน้าร้าน (POS) + ระบบจัดการคลังสินค้าสำหรับร้านค้าไทย ตัดสต็อกอัตโนมัติ รับเงินสด/พร้อมเพย์ รายงานกำไร หลายสาขา เริ่มใช้ฟรี",
  keywords: [
    "ระบบ POS",
    "โปรแกรมขายหน้าร้าน",
    "ระบบคลังสินค้า",
    "โปรแกรมร้านค้า",
    "ระบบจัดการสต็อก",
    "POS ร้านค้า",
    "โปรแกรม POS ฟรี",
    "พร้อมเพย์ร้านค้า",
    "ระบบขายของหน้าร้าน",
  ],
  authors: [{ name: "ขายดี Stock" }],
  // canonical ปล่อยให้แต่ละหน้า public ประกาศเอง (อย่า inherit "/" ไปทุกหน้า)
  openGraph: {
    type: "website",
    locale: "th_TH",
    // ไม่ล็อก url ไว้ที่หน้าแรก — ปล่อยให้ resolve ตาม canonical/route ของแต่ละหน้า
    siteName: "ขายดี Stock",
    title: "ขายดี Stock — ระบบ POS + คลังสินค้า สำหรับร้านค้าไทย",
    description:
      "ขายของ ตัดสต็อก เก็บเงิน จบในระบบเดียว — POS + คลังสินค้าสำหรับร้านไทย เริ่มใช้ฟรี",
  },
  twitter: {
    card: "summary_large_image",
    title: "ขายดี Stock — ระบบ POS + คลังสินค้า สำหรับร้านค้าไทย",
    description:
      "ขายของ ตัดสต็อก เก็บเงิน จบในระบบเดียว — เริ่มใช้ฟรี",
    // ใช้รูป OG ที่ generate จาก app/opengraph-image.tsx เป็น twitter card image
    images: ["/opengraph-image"],
  },
  robots: { index: true, follow: true },
  appleWebApp: {
    capable: true,
    title: "ขายดี Stock",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="th"
      className={`${notoThai.variable} ${prompt.variable} ${chakra.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
