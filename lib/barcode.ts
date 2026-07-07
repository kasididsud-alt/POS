// Built-in barcode generator — ไม่พึ่งไลบรารีภายนอก (zero-dependency)
// รองรับ CODE128 (auto B→C) สำหรับสร้างภาพบาร์โค้ดเป็น SVG
// และตัวสร้างเลข EAN-13 ภายในร้าน สำหรับสินค้าที่ยังไม่มีบาร์โค้ด

// ── CODE128 patterns ───────────────────────────────────────────────
// 107 รหัส (0–106) แต่ละตัวคือความกว้างแถบ 6 ค่า (bar,space สลับ เริ่มที่ bar)
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213",
  "122312", "132212", "221213", "221312", "231212", "112232", "122132",
  "122231", "113222", "123122", "123221", "223211", "221132", "221231",
  "213212", "223112", "312131", "311222", "321122", "321221", "312212",
  "322112", "322211", "212123", "212321", "232121", "111323", "131123",
  "131321", "112313", "132113", "132311", "211313", "231113", "231311",
  "112133", "112331", "132131", "113123", "113321", "133121", "313121",
  "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111",
  "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114",
  "413111", "241112", "134111", "111242", "121142", "121241", "114212",
  "124112", "124211", "411212", "421112", "421211", "212141", "214121",
  "412121", "111143", "111341", "131141", "114113", "114311", "411113",
  "411311", "113141", "114131", "311131", "411131", "211412", "211214",
  "211232", "2331112",
];

const START_B = 104;
const START_C = 105;
const STOP = 106;

/** เข้ารหัสข้อความเป็นชุดรหัส CODE128 (auto switch B/C เพื่อให้สั้น) */
function encodeCode128(value: string): number[] {
  if (!/^[\x00-\x7F]+$/.test(value)) {
    throw new Error("CODE128 รองรับเฉพาะอักขระ ASCII");
  }
  const codes: number[] = [];
  let i = 0;

  // เริ่มด้วย C ถ้าขึ้นต้นด้วยเลขคู่ ≥4 ตัว, อื่นๆ ใช้ B
  const startWithC = digitRun(value, 0) >= 4 || (digitRun(value, 0) >= 2 && value.length === digitRun(value, 0));
  let mode: "B" | "C" = startWithC ? "C" : "B";
  codes.push(startWithC ? START_C : START_B);

  while (i < value.length) {
    if (mode === "C") {
      const run = digitRun(value, i);
      if (run >= 2) {
        codes.push(parseInt(value.substr(i, 2), 10));
        i += 2;
        continue;
      }
      // เหลือเลขคี่ตัวเดียวหรือเจอตัวอักษร → สลับไป B
      codes.push(100); // Code B
      mode = "B";
    } else {
      const run = digitRun(value, i);
      if (run >= 4 && (run % 2 === 0 || run >= 6)) {
        codes.push(99); // Code C
        mode = "C";
        continue;
      }
      codes.push(value.charCodeAt(i) - 32);
      i += 1;
    }
  }

  // checksum
  let sum = codes[0];
  for (let k = 1; k < codes.length; k++) sum += codes[k] * k;
  codes.push(sum % 103);
  codes.push(STOP);
  return codes;
}

/** จำนวนหลักตัวเลขติดกันเริ่มจากตำแหน่ง pos */
function digitRun(s: string, pos: number): number {
  let n = 0;
  while (pos + n < s.length && s[pos + n] >= "0" && s[pos + n] <= "9") n++;
  return n;
}

export type BarcodeOptions = {
  /** ความกว้างของแถบบางสุด (px ต่อหน่วย) */
  moduleWidth?: number;
  /** ความสูงแถบ (px) */
  height?: number;
  /** แสดงข้อความใต้บาร์โค้ด */
  displayValue?: boolean;
  /** ขอบขาว (quiet zone) เป็นจำนวนหน่วย */
  quietZone?: number;
  fontSize?: number;
};

/** สร้าง SVG string ของบาร์โค้ด CODE128 จากค่า value */
export function code128SVG(value: string, opts: BarcodeOptions = {}): string {
  const moduleWidth = opts.moduleWidth ?? 2;
  const height = opts.height ?? 60;
  const displayValue = opts.displayValue ?? true;
  const quietZone = opts.quietZone ?? 10;
  const fontSize = opts.fontSize ?? 14;

  const codes = encodeCode128(value);
  const textGap = displayValue ? fontSize + 4 : 0;

  // รวมความกว้างทั้งหมดเป็นจำนวนหน่วย
  let units = 0;
  const segments: { x: number; w: number }[] = [];
  let x = quietZone;
  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code];
    for (let p = 0; p < pattern.length; p++) {
      const w = parseInt(pattern[p], 10);
      if (p % 2 === 0) segments.push({ x, w }); // index คู่ = แถบดำ
      x += w;
    }
  }
  units = x + quietZone;

  const totalWidth = units * moduleWidth;
  const totalHeight = height + textGap;

  const rects = segments
    .map(
      (s) =>
        `<rect x="${(s.x * moduleWidth).toFixed(2)}" y="0" width="${(s.w * moduleWidth).toFixed(2)}" height="${height}" />`,
    )
    .join("");

  const text = displayValue
    ? `<text x="${(totalWidth / 2).toFixed(2)}" y="${totalHeight - 2}" font-family="monospace" font-size="${fontSize}" text-anchor="middle" fill="#000">${escapeXml(spacedValue(value))}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth.toFixed(0)} ${totalHeight.toFixed(0)}" width="${totalWidth.toFixed(0)}" height="${totalHeight.toFixed(0)}" shape-rendering="crispEdges"><rect x="0" y="0" width="${totalWidth.toFixed(0)}" height="${totalHeight.toFixed(0)}" fill="#fff"/><g fill="#000">${rects}</g>${text}</svg>`;
}

function spacedValue(v: string): string {
  return v.length > 4 ? v.replace(/(.{4})/g, "$1 ").trim() : v;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;",
  );
}

// ── EAN-13 internal code generator ─────────────────────────────────
/** คำนวณ check digit ของ EAN-13 จาก 12 หลักแรก */
export function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * สร้างเลขบาร์โค้ด EAN-13 ภายในร้าน
 * ใช้ prefix 20 (ตามมาตรฐาน in-store/restricted) + เลขลำดับ
 * seq = ตัวเลขไม่ซ้ำ (เช่นนับจำนวนสินค้า + เวลา)
 */
export function generateInternalEAN13(seq: number): string {
  const body = "20" + String(seq % 10_000_000_000).padStart(10, "0");
  return body + String(ean13CheckDigit(body));
}

/** ตรวจว่า value เป็น EAN-13 ที่ check digit ถูกต้องไหม */
export function isValidEAN13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  return ean13CheckDigit(value.slice(0, 12)) === Number(value[12]);
}
