export function formatTHB(amount: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
  }).format(amount ?? 0);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

const THAI_DIGITS = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const THAI_PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

/** อ่านเลขจำนวนเต็ม (สูงสุด 6 หลัก) เป็นข้อความไทย */
function readThaiGroup(numStr: string): string {
  let out = "";
  const len = numStr.length;
  for (let i = 0; i < len; i++) {
    const d = Number(numStr[i]);
    const place = len - i - 1;
    if (d === 0) continue;
    if (place === 1 && d === 1) out += "สิบ";
    else if (place === 1 && d === 2) out += "ยี่สิบ";
    else if (place === 0 && d === 1 && len > 1) out += "เอ็ด";
    else out += THAI_DIGITS[d] + THAI_PLACES[place];
  }
  return out;
}

function readThaiNumber(num: number): string {
  if (num === 0) return "ศูนย์";
  const groups: string[] = [];
  let s = String(num);
  while (s.length > 6) {
    groups.unshift(s.slice(-6));
    s = s.slice(0, -6);
  }
  groups.unshift(s);
  let out = "";
  for (let i = 0; i < groups.length; i++) {
    const g = readThaiGroup(groups[i]);
    out += g;
    if (i < groups.length - 1 && g !== "") out += "ล้าน";
  }
  return out;
}

/** แปลงจำนวนเงินเป็นข้อความไทย เช่น 1250.50 → "หนึ่งพันสองร้อยห้าสิบบาทห้าสิบสตางค์" */
export function bahtText(amount: number): string {
  const n = Number(amount) || 0;
  const abs = Math.abs(n);
  const baht = Math.floor(abs);
  const satang = Math.round((abs - baht) * 100);

  let text = "";
  if (baht > 0) text += readThaiNumber(baht) + "บาท";
  if (satang > 0) text += readThaiNumber(satang) + "สตางค์";
  else text += (baht > 0 ? "" : "ศูนย์บาท") + "ถ้วน";

  return (n < 0 ? "ลบ" : "") + text;
}
