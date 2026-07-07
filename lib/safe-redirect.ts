// กันช่องโหว่ open redirect: อนุญาตเฉพาะปลายทางที่เป็น "path ภายใน" เท่านั้น
// ใช้ร่วมกันในทุกจุดที่รับปลายทางจากผู้ใช้ (เช่น ?next=) ก่อน redirect

/**
 * คืน path ภายในที่ปลอดภัยสำหรับ redirect
 * ปฏิเสธ: absolute URL (https://evil), protocol-relative (//evil.com),
 * และ backslash trick (/\evil.com หรือ /%5Cevil.com) ที่เบราว์เซอร์บางตัว
 * ตีความเป็นโดเมนภายนอก แล้ว fallback ไปค่าเริ่มต้น
 */
export function safeInternalPath(
  next: unknown,
  fallback = "/dashboard",
): string {
  if (typeof next !== "string" || next.length === 0) return fallback;
  // ต้องขึ้นต้นด้วย "/" (path ภายใน) และห้ามเป็น protocol-relative "//host"
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  // ปิด backslash trick: "/\\host" (และรูปแบบ encode) → โดเมนภายนอก
  if (next.startsWith("/\\") || next.startsWith("/%5C") || next.startsWith("/%5c"))
    return fallback;
  return next;
}
