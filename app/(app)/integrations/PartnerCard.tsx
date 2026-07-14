"use client";

import { useState } from "react";
import Modal from "@/components/Modal";

export type PartnerInfo = {
  icon: string;
  name: string;
  desc: string;
  /** ขั้นตอนสมัคร/สิ่งที่ต้องมีก่อนเชื่อมต่อ */
  steps: string[];
  /** ลิงก์พอร์ทัลสมัครของผู้ให้บริการ (ถ้ามี) */
  portal?: { label: string; url: string };
};

/**
 * การ์ดพาร์ทเนอร์ที่ยังเชื่อม API ไม่ได้ (ต้องมีบัญชี/สัญญากับผู้ให้บริการก่อน)
 * — ปุ่มไม่ตายเปล่า: กดแล้วบอกชัดว่าต้องเตรียมอะไร ได้ credentials อะไรมา
 */
export default function PartnerCard({ info }: { info: PartnerInfo }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="card flex items-center gap-4 p-4">
        <div className="text-3xl">{info.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="font-medium">{info.name}</div>
          <div className="text-xs text-[var(--muted)]">{info.desc}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            ต้องมีบัญชีพาร์ทเนอร์
          </span>
          <button onClick={() => setOpen(true)} className="btn-outline px-3 py-1 text-xs">
            ดูวิธีเชื่อมต่อ
          </button>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={`เชื่อมต่อ ${info.name}`}>
        <div className="space-y-3 text-sm">
          <p className="text-[var(--muted)]">
            การเชื่อมต่อ {info.name} ต้องใช้บัญชี/API credentials
            ที่ออกโดยผู้ให้บริการโดยตรง — ขั้นตอนเตรียมของ:
          </p>
          <ol className="list-decimal space-y-1.5 pl-5">
            {info.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {info.portal && (
            <a
              href={info.portal.url}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-[var(--primary)] underline"
            >
              {info.portal.label} →
            </a>
          )}
          <div className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
            เมื่อได้ credentials ครบแล้ว แจ้งผ่านหน้า{" "}
            <a href="/contact" className="font-semibold underline">
              ติดต่อทีมงาน
            </a>{" "}
            เพื่อเปิดการเชื่อมต่อให้ร้านคุณ
            (ระบบจะเพิ่มช่องกรอกให้เมื่อช่องทางนี้เปิดใช้งาน)
          </div>
        </div>
      </Modal>
    </>
  );
}
