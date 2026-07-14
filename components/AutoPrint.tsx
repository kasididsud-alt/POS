"use client";

import { useEffect } from "react";

type Paper = "58" | "80" | "a4";

const PAGE: Record<Paper, string> = {
  "58": "@page { size: 58mm auto; margin: 2mm; }",
  "80": "@page { size: 80mm auto; margin: 3mm; }",
  a4: "@page { size: A4; margin: 12mm; }",
};

/** สั่งพิมพ์ทันทีที่หน้าใบเสร็จโหลด — ใช้เมื่อเปิดด้วย ?print=80|58|a4
    (หน้า POS ฝังหน้านี้ใน iframe ที่ซ่อนไว้ เพื่อพิมพ์สลิปโดยไม่ออกจากหน้าขาย) */
export default function AutoPrint({ paper }: { paper: string }) {
  useEffect(() => {
    const p: Paper = paper === "58" || paper === "a4" ? paper : "80";
    let style = document.getElementById(
      "paper-size-rule",
    ) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = "paper-size-rule";
      document.head.appendChild(style);
    }
    style.textContent = PAGE[p];
    document.documentElement.dataset.paper = p;

    // รอฟอนต์ไทยโหลดก่อนค่อยสั่งพิมพ์ กันสลิปออกมาเป็นฟอนต์สำรอง
    let cancelled = false;
    let fired = false;
    const go = () => {
      if (cancelled || fired) return;
      fired = true;
      window.print();
    };
    document.fonts.ready.then(go);
    const fallback = setTimeout(go, 1500);
    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, [paper]);

  return null;
}
