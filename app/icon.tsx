import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// ไอคอนแอป (PWA) — สร้างอัตโนมัติเป็น PNG โทนแบรนด์
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#4f46e5",
          fontSize: 320,
        }}
      >
        🧾
      </div>
    ),
    { ...size },
  );
}
