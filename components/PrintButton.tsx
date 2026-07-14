"use client";

export default function PrintButton({
  label = "🖨️ พิมพ์ใบเสร็จ",
}: {
  label?: string;
}) {
  return (
    <button onClick={() => window.print()} className="btn-outline print:hidden">
      {label}
    </button>
  );
}
