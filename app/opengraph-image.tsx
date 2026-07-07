import { ImageResponse } from "next/og";

export const alt = "ขายดี Stock — POS + Inventory system for Thai shops";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// OG image แบบ generate อัตโนมัติ (โทนใบเสร็จ) — ใช้ตัวอักษร Latin เพื่อความชัวร์ของฟอนต์
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fbf9f4",
          padding: "72px",
          fontFamily: "monospace",
          color: "#18221c",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, letterSpacing: 4 }}>
          <span>🧾</span>
          <span style={{ fontWeight: 700 }}>KHAIDEESTOCK</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 78, fontWeight: 700, lineHeight: 1.05 }}>
            Sell · Track stock
          </div>
          <div style={{ display: "flex", gap: 18, fontSize: 78, fontWeight: 700, lineHeight: 1.05 }}>
            <span>Get paid</span>
            <span style={{ color: "#0e7a43" }}>— all in one</span>
          </div>
          <div style={{ fontSize: 30, color: "#6f7a6f", marginTop: 12 }}>
            POS + Inventory system for Thai shops · Start free
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* barcode motif */}
          <div style={{ display: "flex", gap: 4 }}>
            {[6, 2, 4, 2, 8, 2, 3, 6, 2, 5, 2, 7, 3, 2, 6].map((w, i) => (
              <div key={i} style={{ width: w, height: 56, background: "#18221c" }} />
            ))}
          </div>
          <div
            style={{
              border: "3px solid #e0492b",
              color: "#e0492b",
              borderRadius: 10,
              padding: "10px 22px",
              fontSize: 28,
              fontWeight: 700,
              transform: "rotate(-6deg)",
            }}
          >
            FREE 14 DAYS
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
