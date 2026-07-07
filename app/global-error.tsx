"use client"; // Error boundary ต้องเป็น Client Component

export default function GlobalError({
  unstable_retry,
}: {
  unstable_retry: () => void;
}) {
  return (
    // global-error ต้องมี html และ body เป็นของตัวเอง (แทน root layout)
    <html lang="th">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "2.5rem" }}>😵‍💫</div>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>
          เกิดข้อผิดพลาด
        </h2>
        <p style={{ maxWidth: "24rem", color: "#64748b", fontSize: "0.875rem" }}>
          ระบบสะดุดไปชั่วขณะ — ลองอีกครั้งได้เลย
        </p>
        <button
          onClick={() => unstable_retry()}
          style={{
            borderRadius: "0.5rem",
            background: "#4f46e5",
            color: "#fff",
            padding: "0.5rem 1.25rem",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
          }}
        >
          ลองใหม่อีกครั้ง
        </button>
      </body>
    </html>
  );
}
