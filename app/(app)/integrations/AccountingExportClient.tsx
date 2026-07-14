"use client";

import { useEffect, useState, useTransition } from "react";
import Modal from "@/components/Modal";
import { exportSalesCsv } from "./actions";

/**
 * FlowAccount / PEAK — ทั้งสองเจ้ารองรับนำเข้าไฟล์ CSV
 * จึงส่งออกยอดขายเป็นไฟล์ให้เอาไปนำเข้าได้เลย ไม่ต้องมี API key
 */
export default function AccountingExportClient() {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ค่าเริ่มต้น: ต้นเดือนนี้ → วันนี้ (ตั้งหลัง mount กัน hydration เพี้ยนข้ามเที่ยงคืน)
  useEffect(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    setFrom(ymd(new Date(now.getFullYear(), now.getMonth(), 1)));
    setTo(ymd(now));
  }, []);

  function download() {
    setMsg(null);
    start(async () => {
      const res = await exportSalesCsv(from, to);
      if (!res.ok || res.csv === undefined) {
        setMsg({ ok: false, text: res.error ?? "ส่งออกไม่สำเร็จ" });
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales_${from}_${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ ok: true, text: `ดาวน์โหลดแล้ว — ${res.rows} บิล (${from} ถึง ${to})` });
    });
  }

  return (
    <>
      <div className="card flex items-center gap-4 p-4">
        <div className="text-3xl">🧾</div>
        <div className="min-w-0 flex-1">
          <div className="font-medium">FlowAccount / PEAK</div>
          <div className="text-xs text-[var(--muted)]">
            ส่งออกยอดขายเป็น CSV — นำเข้าโปรแกรมบัญชีได้ทันที
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            พร้อมใช้
          </span>
          <button
            onClick={() => {
              setMsg(null);
              setOpen(true);
            }}
            className="btn-outline px-3 py-1 text-xs"
          >
            ส่งออกไฟล์
          </button>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="ส่งออกยอดขาย (CSV)">
        <div className="space-y-3">
          {msg && (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {msg.text}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">ตั้งแต่วันที่</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">ถึงวันที่</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="input"
              />
            </div>
          </div>
          <button disabled={pending || !from || !to} onClick={download} className="btn-primary w-full">
            {pending ? "กำลังเตรียมไฟล์..." : "ดาวน์โหลด CSV"}
          </button>
          <p className="text-xs text-[var(--muted)]">
            คอลัมน์: วันที่ · เลขที่บิล · ยอดก่อนส่วนลด · ส่วนลด · ยอดสุทธิ · วิธีชำระ · สาขา ·
            ลูกค้า — ไฟล์เป็น UTF-8 (มี BOM) เปิดใน Excel/นำเข้า FlowAccount/PEAK ได้เลย
          </p>
        </div>
      </Modal>
    </>
  );
}
