"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";

/**
 * สแกนบาร์โค้ดด้วยกล้อง — เรียก onDetected(code) เมื่ออ่านได้
 * มีช่องกรอกมือสำรองกรณีกล้องใช้ไม่ได้
 */
export default function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const detectedRef = useRef(false);

  useEffect(() => {
    let controls: IScannerControls | undefined;
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result, _err, c) => {
        controls = c;
        if (result && !detectedRef.current) {
          detectedRef.current = true;
          onDetected(result.getText());
        }
      })
      .then((c) => {
        if (cancelled) c.stop();
        else controls = c;
      })
      .catch(() => {
        setError("เปิดกล้องไม่ได้ — ใช้ช่องกรอกบาร์โค้ดด้านล่างแทน");
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [onDetected]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-sm overflow-hidden p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">สแกนบาร์โค้ด</h2>
          <button onClick={onClose} className="text-2xl leading-none text-slate-400">
            ×
          </button>
        </div>

        {!error ? (
          <div className="relative overflow-hidden rounded-lg bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} className="aspect-square w-full object-cover" />
            <div className="pointer-events-none absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80" />
          </div>
        ) : (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {error}
          </p>
        )}

        <p className="mt-2 text-center text-xs text-[var(--muted)]">
          เล็งกล้องไปที่บาร์โค้ด หรือกรอกเลขเอง
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = manual.trim();
            if (v) onDetected(v);
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="กรอกเลขบาร์โค้ด"
            className="input"
            autoFocus={!!error}
          />
          <button type="submit" className="btn-primary whitespace-nowrap">
            ตกลง
          </button>
        </form>
      </div>
    </div>
  );
}
