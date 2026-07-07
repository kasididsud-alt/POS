"use client"; // Error boundary ต้องเป็น Client Component

import { useEffect } from "react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-4xl">😵‍💫</div>
      <h2 className="text-xl font-bold">เกิดข้อผิดพลาดชั่วคราว</h2>
      <p className="max-w-sm text-sm text-[var(--muted)]">
        ระบบสะดุดไปชั่วขณะ — ลองอีกครั้งได้เลย ถ้ายังไม่หายลองรีเฟรชหน้าใหม่
      </p>
      <button onClick={() => unstable_retry()} className="btn-primary">
        ลองใหม่อีกครั้ง
      </button>
    </div>
  );
}
