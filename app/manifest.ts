import type { MetadataRoute } from "next";

// PWA manifest — ทำให้ติดตั้งลงหน้าจอโฮม/เดสก์ท็อปได้ (ใช้งานหน้าร้านเหมือนแอป)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ขายดี Stock — ระบบ POS + คลังสินค้า",
    short_name: "ขายดี Stock",
    description:
      "ขายหน้าร้าน + จัดการสต็อก + ออกใบกำกับภาษี + สร้างบาร์โค้ด ครบจบในเว็บเดียว",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#4f46e5",
    lang: "th",
    categories: ["business", "productivity", "shopping"],
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
  };
}
