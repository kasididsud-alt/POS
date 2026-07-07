"use client";

import { useState } from "react";

type Paper = "80" | "58" | "a4";

const PAGE: Record<Paper, string> = {
  "80": "@page { size: 80mm auto; margin: 3mm; }",
  "58": "@page { size: 58mm auto; margin: 2mm; }",
  a4: "@page { size: A4; margin: 12mm; }",
};

/** ปุ่มพิมพ์ที่เลือกขนาดกระดาษได้ (กระดาษความร้อน 80/58mm หรือ A4) */
export default function ThermalPrintButton() {
  const [paper, setPaper] = useState<Paper>("80");

  function print(p: Paper) {
    // ใส่ขนาดหน้ากระดาษ + ตั้ง data-paper ให้ CSS จัดความกว้าง
    let style = document.getElementById("paper-size-rule") as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = "paper-size-rule";
      document.head.appendChild(style);
    }
    style.textContent = PAGE[p];
    document.documentElement.dataset.paper = p;
    window.print();
  }

  return (
    <div className="flex items-center gap-1 print:hidden">
      <select
        value={paper}
        onChange={(e) => setPaper(e.target.value as Paper)}
        className="input w-auto py-1.5 text-sm"
        title="ขนาดกระดาษ"
      >
        <option value="80">80mm</option>
        <option value="58">58mm</option>
        <option value="a4">A4</option>
      </select>
      <button onClick={() => print(paper)} className="btn-outline">
        🖨️ พิมพ์
      </button>
    </div>
  );
}
