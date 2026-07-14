import { requireOwnerPage } from "@/lib/guard";
import { query } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

const ACTION_LABEL: Record<string, string> = {
  "product.create": "เพิ่มสินค้า",
  "product.update": "แก้ไขสินค้า",
  "product.delete": "ลบสินค้า",
  "product.barcode.generate": "สร้างบาร์โค้ด",
  "stock.purchase": "รับสต็อก",
  "stock.adjust": "ปรับสต็อก",
  "stock.return": "รับคืนสต็อก",
  "stock.reduce": "ลดสต็อก",
  "stock.receive": "รับสินค้าเข้า",
  "stock.issue": "เบิก/ตัดจ่าย",
  "sale.checkout": "ขายสินค้า (POS)",
  "sale.return": "คืนสินค้า/คืนเงิน",
  "transfer.create": "สร้างใบโอนสาขา",
  "transfer.received": "รับของใบโอน",
  "transfer.cancelled": "ยกเลิกใบโอน",
  "po.create": "สร้างใบสั่งซื้อ",
  "po.receive": "รับของตามใบสั่งซื้อ",
  "po.cancel": "ยกเลิกใบสั่งซื้อ",
  "so.create": "สร้างออเดอร์ขายส่ง",
  "so.status": "เปลี่ยนสถานะออเดอร์",
  "so.fulfill": "ส่งมอบออเดอร์ + ตัดสต็อก",
  "so.sms": "ส่ง SMS แจ้งลูกค้า",
  "shift.open": "เปิดกะ",
  "shift.close": "ปิดกะ / นับเงิน",
  "debt.create": "ตั้งหนี้ลูกค้า",
  "debt.payment": "รับชำระหนี้",
  "debt.delete": "ลบรายการหนี้",
  "staff.invite": "เชิญพนักงาน",
  "staff.role": "เปลี่ยนบทบาทพนักงาน",
  "staff.branch": "ย้ายสาขาพนักงาน",
  "staff.remove": "ลบพนักงาน",
  "branch.create": "เพิ่มสาขา/คลัง",
  "branch.update": "แก้ไขสาขา/คลัง",
  "branch.delete": "ลบสาขา/คลัง",
  "promotion.create": "เพิ่มโปรโมชั่น",
  "promotion.update": "แก้ไขโปรโมชั่น",
  "promotion.delete": "ลบโปรโมชั่น",
  "promotion.broadcast": "ส่งโปรเข้า LINE ลูกค้า",
  "apikey.create": "สร้าง API key",
  "apikey.revoke": "ยกเลิก API key",
  "integration.line.connect": "เชื่อมต่อ LINE",
  "integration.line.disconnect": "ยกเลิกเชื่อมต่อ LINE",
  "integration.gateway.connect": "เชื่อมต่อ Omise/Stripe",
  "integration.gateway.disconnect": "ยกเลิกเชื่อมต่อ Omise/Stripe",
  "integration.sms.connect": "เชื่อมต่อ SMS",
  "integration.sms.disconnect": "ยกเลิกเชื่อมต่อ SMS",
  signup: "สมัครใช้งาน",
  "admin.comp_plan": "ผู้ดูแลระบบปรับแพ็ก",
  "admin.extend_trial": "ผู้ดูแลระบบขยายเวลาทดลอง",
  "admin.set_role": "ผู้ดูแลระบบเปลี่ยนบทบาท",
};

type LogRow = {
  id: string;
  action: string;
  detail: string | null;
  created_at: string;
  email: string | null;
};

export default async function AuditPage() {
  const ctx = await requireOwnerPage();

  const logs = await query<LogRow>(
    `select a.id, a.action, a.detail, a.created_at, u.email
       from audit_logs a left join users u on u.id = a.user_id
      where a.org_id = $1
      order by a.created_at desc limit 200`,
    [ctx.org.id],
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">บันทึกการใช้งาน</h1>
      <p className="text-sm text-[var(--muted)]">
        ประวัติการกระทำสำคัญในระบบ (200 รายการล่าสุด)
      </p>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">เวลา</th>
              <th className="px-4 py-3">ผู้ใช้</th>
              <th className="px-4 py-3">การกระทำ</th>
              <th className="px-4 py-3">รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-[var(--muted)]">
                  ยังไม่มีบันทึก
                </td>
              </tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 text-[var(--muted)]">
                  {formatDateTime(l.created_at)}
                </td>
                <td className="px-4 py-3">{l.email ?? "—"}</td>
                <td className="px-4 py-3">{ACTION_LABEL[l.action] ?? l.action}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{l.detail ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
