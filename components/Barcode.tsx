"use client";

import { useMemo } from "react";
import { code128SVG, type BarcodeOptions } from "@/lib/barcode";

type Props = BarcodeOptions & {
  value: string;
  className?: string;
};

/** แสดงบาร์โค้ด CODE128 เป็น SVG (สร้างในตัวเอง ไม่พึ่งบริการภายนอก) */
export default function Barcode({ value, className, ...opts }: Props) {
  const svg = useMemo(() => {
    if (!value) return "";
    try {
      return code128SVG(value, opts);
    } catch {
      return "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, opts.moduleWidth, opts.height, opts.displayValue, opts.quietZone, opts.fontSize]);

  if (!svg) {
    return (
      <span className="text-xs text-[var(--muted)]">— ไม่มีบาร์โค้ด —</span>
    );
  }
  return (
    <span
      className={className}
      // svg มาจากฟังก์ชันภายในของเรา ไม่มี input ภายนอกฝังตรง (escape แล้ว)
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
