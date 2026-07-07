"use client";

import { useRef, useState } from "react";

const MAX_DIM = 400; // px ด้านยาวสุด
const QUALITY = 0.72;

/**
 * อัปโหลดรูปสินค้า — ย่อขนาดฝั่ง client เป็น data URL (JPEG)
 * ส่งค่าออกผ่าน hidden input ชื่อ `name` เพื่อบันทึกลง products.image_url
 */
export default function ImageUpload({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: string | null;
}) {
  const [value, setValue] = useState<string>(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          setValue(canvas.toDataURL("image/jpeg", QUALITY));
        }
        setBusy(false);
      };
      img.onerror = () => setBusy(false);
      img.src = reader.result as string;
    };
    reader.onerror = () => setBusy(false);
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-slate-50 text-xl text-slate-300">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="ตัวอย่างสินค้า" className="h-full w-full object-cover" />
          ) : (
            "🖼️"
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn-outline px-3 py-1.5 text-sm"
          >
            {busy ? "กำลังย่อ..." : value ? "เปลี่ยนรูป" : "เลือกรูป"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => setValue("")}
              className="btn-ghost px-3 py-1.5 text-sm text-red-600"
            >
              ลบรูป
            </button>
          )}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />
    </div>
  );
}
