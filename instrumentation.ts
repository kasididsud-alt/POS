// รันครั้งเดียวตอน server เริ่ม (Next instrumentation hook)
// ด่านกันพลาดตอน deploy: config อันตราย/ขาดหาย ให้ล้มตั้งแต่ boot ไม่ใช่ไปพังกลางทาง
// (ตาม checklist ใน ROADMAP.md — เปลี่ยนจาก "ต้องจำ" เป็น "ระบบบังคับ")
export function register() {
  if (process.env.NODE_ENV !== "production") return;

  const problems: string[] = [];

  // DEV_PLAN override แพ็กเกจทุกร้านทั้งระบบ — ห้ามหลุดไป production เด็ดขาด
  if (process.env.DEV_PLAN) {
    problems.push(
      "DEV_PLAN ถูกตั้งไว้ — ตัวนี้ override แพ็กเกจทุกร้านทั้งระบบ ห้ามใช้ใน production (ลบ ENV นี้ออก)",
    );
  }

  // ไม่ตั้ง = canonical/OG/sitemap ชี้ localhost ทั้งเว็บ
  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    problems.push(
      "ไม่ได้ตั้ง NEXT_PUBLIC_SITE_URL — SEO/ลิงก์ในอีเมลจะชี้ localhost (ตั้งเป็น URL จริง เช่น https://khaideestock.com)",
    );
  }

  // ไม่ตั้ง = session cookie ไม่ติด Secure flag บน HTTPS
  if (process.env.COOKIE_SECURE !== "true") {
    problems.push(
      "COOKIE_SECURE ต้องเป็น 'true' ใน production — ไม่งั้น session cookie ถูกส่งผ่าน HTTP ได้",
    );
  }

  if (problems.length) {
    throw new Error(
      "❌ ตรวจ ENV ก่อนขึ้น production ไม่ผ่าน:\n- " + problems.join("\n- "),
    );
  }
}
