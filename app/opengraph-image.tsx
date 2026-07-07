import { ImageResponse } from "next/og";

export const alt = "ขายดี Stock — ระบบ POS + จัดการสต็อก สำหรับร้านค้าไทย";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// โหลดฟอนต์ไทย (Noto Sans Thai) จาก Google Fonts เพื่อ render กลิฟไทยใน OG image
// ถ้าโหลดไม่ได้ (offline/บิลด์แบบไม่มีเน็ต) จะ fallback เป็นดีไซน์ Latin เดิม
async function loadThaiFont(weight: 400 | 700): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@${weight}`,
      // UA เก่าเพื่อให้ Google ส่ง URL แบบ .ttf (Satori ไม่รองรับ woff2)
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; Node.js)" } },
    ).then((r) => (r.ok ? r.text() : ""));
    const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const [thaiRegular, thaiBold] = await Promise.all([
    loadThaiFont(400),
    loadThaiFont(700),
  ]);
  const hasThai = !!thaiRegular && !!thaiBold;

  const fonts = hasThai
    ? [
        { name: "Noto Sans Thai", data: thaiRegular!, weight: 400 as const },
        { name: "Noto Sans Thai", data: thaiBold!, weight: 700 as const },
      ]
    : undefined;

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
          fontFamily: hasThai ? "Noto Sans Thai, monospace" : "monospace",
          color: "#18221c",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, letterSpacing: 4 }}>
          <span>🧾</span>
          <span style={{ fontWeight: 700 }}>{hasThai ? "ขายดี Stock" : "KHAIDEESTOCK"}</span>
        </div>

        {hasThai ? (
          <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: 10 }}>
            <div style={{ display: "flex", fontSize: 64, fontWeight: 700, lineHeight: 1.18 }}>
              ขายของ ตัดสต็อก เก็บเงิน
            </div>
            <div style={{ display: "flex", fontSize: 64, fontWeight: 700, lineHeight: 1.18, color: "#0e7a43" }}>
              จบในระบบเดียว
            </div>
            <div style={{ display: "flex", fontSize: 30, color: "#6f7a6f", marginTop: 14 }}>
              ระบบ POS + จัดการสต็อก สำหรับร้านค้าไทย · เริ่มใช้ฟรี
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: 14 }}>
            <div style={{ display: "flex", fontSize: 78, fontWeight: 700, lineHeight: 1.05 }}>
              Sell · Track stock
            </div>
            <div style={{ display: "flex", gap: 18, fontSize: 78, fontWeight: 700, lineHeight: 1.05 }}>
              <span>Get paid</span>
              <span style={{ color: "#0e7a43" }}>— all in one</span>
            </div>
            <div style={{ display: "flex", fontSize: 30, color: "#6f7a6f", marginTop: 12 }}>
              POS + Inventory system for Thai shops · Start free
            </div>
          </div>
        )}

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
            {hasThai ? "เริ่มฟรี 14 วัน" : "FREE 14 DAYS"}
          </div>
        </div>
      </div>
    ),
    { ...size, ...(fonts ? { fonts } : {}) },
  );
}
