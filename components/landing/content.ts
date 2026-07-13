export type IconName =
  | "scan"
  | "inventory"
  | "chart"
  | "branches"
  | "users"
  | "shield"
  | "receipt"
  | "arrow"
  | "check"
  | "alert";

type CopyItem = Readonly<{
  id: string;
  title: string;
  description: string;
  icon: IconName;
}>;

export const TICKER_ITEMS = [
  { id: "sales", label: "ยอดขายวันนี้", value: "฿12,450" },
  { id: "bill", label: "บิลล่าสุด", value: "#087" },
  { id: "stock", label: "สต็อกใกล้หมด", value: "4 รายการ" },
  { id: "profit", label: "กำไรวันนี้", value: "+18%" },
  { id: "transfer", label: "รับโอนเข้าคลัง", value: "12 ชิ้น" },
] as const;

export const OUTCOMES = [
  { id: "fast", title: "ขายได้เร็วขึ้น", description: "สแกนสินค้า คิดเงิน และออกใบเสร็จในหน้าจอเดียว", icon: "scan" },
  { id: "accurate", title: "สต็อกตรงทุกบิล", description: "ตัดสต็อกทันที พร้อมประวัติรับเข้า โอน และตรวจนับ", icon: "inventory" },
  { id: "profit", title: "รู้กำไรทุกวัน", description: "เห็นยอดขาย ต้นทุน และกำไรจากข้อมูลจริงของร้าน", icon: "chart" },
] as const satisfies readonly CopyItem[];

export const WORKFLOW_STEPS = [
  { id: "setup", step: "01", title: "ตั้งสินค้า", description: "เพิ่มสินค้า ราคา บาร์โค้ด และสต็อกตั้งต้น" },
  { id: "sell", step: "02", title: "เปิดขาย", description: "เลือกหรือสแกนสินค้า แล้วรับเงินสดหรือพร้อมเพย์" },
  { id: "sync", step: "03", title: "สต็อกตัดเอง", description: "ทุกบิลอัปเดตจำนวนคงเหลือและต้นทุนอัตโนมัติ" },
  { id: "report", step: "04", title: "ดูรายงาน", description: "เช็กยอดขาย กำไร และสินค้าที่ต้องเติมได้ทันที" },
] as const;

export const FEATURES = [
  { id: "inventory", title: "คลังสินค้าครบวงจร", description: "รับเข้า เบิก โอน ตรวจนับ ล็อต และวันหมดอายุ", icon: "inventory" },
  { id: "branches", title: "หลายสาขาในที่เดียว", description: "ดูสต็อกแยกสาขาและโอนสินค้าได้อย่างมีประวัติ", icon: "branches" },
  { id: "members", title: "ลูกค้าและสมาชิก", description: "เก็บประวัติซื้อ แต้ม โปรโมชั่น และข้อมูลติดต่อ", icon: "users" },
  { id: "receivables", title: "ขายเชื่อและลูกหนี้", description: "ติดตามยอดค้าง รับชำระ และดูสถานะลูกหนี้เป็นระบบ", icon: "receipt" },
  { id: "reports", title: "รายงานที่ใช้ตัดสินใจ", description: "ยอดขาย กำไร สินค้าขายดี และสต็อกใกล้หมด", icon: "chart" },
  { id: "permissions", title: "สิทธิ์พนักงานชัดเจน", description: "แยกเจ้าของ ผู้จัดการ และแคชเชียร์ พร้อม audit log", icon: "shield" },
] as const satisfies readonly CopyItem[];

export const STORE_TYPES = [
  { id: "minimart", title: "มินิมาร์ท", description: "ขายเร็วด้วยบาร์โค้ดและเตือนของใกล้หมด" },
  { id: "wholesale", title: "ร้านขายส่ง", description: "ดูต้นทุน ลูกหนี้ และจำนวนสินค้าหลายรายการ" },
  { id: "beauty", title: "ร้านเครื่องสำอาง", description: "จัดการล็อต สมาชิก โปรโมชั่น และหลายราคา" },
  { id: "parts", title: "ร้านอะไหล่", description: "ค้นหาสินค้าไว แยกตำแหน่งเก็บ และตรวจนับง่าย" },
] as const;

export const FAQ_ITEMS = [
  { id: "free", question: "เริ่มใช้ฟรีได้ไหม?", answer: "ได้ แพ็กเริ่มต้นใช้ฟรีและไม่ต้องใช้บัตรเครดิต ส่วนแพ็กแบบชำระเงินทดลองใช้ได้ 14 วัน" },
  { id: "device", question: "ต้องซื้อเครื่องใหม่หรือไม่?", answer: "ไม่ต้อง ใช้ผ่านเบราว์เซอร์บนมือถือ แท็บเล็ต หรือคอมพิวเตอร์ และรองรับเครื่องสแกนบาร์โค้ดทั่วไป" },
  { id: "payment", question: "รับชำระเงินแบบไหนได้บ้าง?", answer: "รองรับเงินสดและสร้าง QR พร้อมเพย์ระบุยอดอัตโนมัติ โดยร้านเป็นผู้ยืนยันการรับเงิน" },
  { id: "security", question: "ข้อมูลของแต่ละร้านแยกจากกันไหม?", answer: "แยกข้อมูลตามร้านและสาขาฝั่งเซิร์ฟเวอร์ พร้อมสิทธิ์ผู้ใช้และบันทึกการทำงาน" },
] as const;
