"use client";

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-outline print:hidden">
      🖨️ พิมพ์ใบเสร็จ
    </button>
  );
}
