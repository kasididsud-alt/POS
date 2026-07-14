import { requirePage } from "@/lib/guard";
import { query } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import ContactClient from "./ContactClient";

type MessageRow = {
  id: string;
  topic: string;
  message: string;
  created_at: string;
  resolved_at: string | null;
};

export default async function ContactPage() {
  const ctx = await requirePage();

  // ประวัติข้อความของร้านนี้ — เห็นว่าอันไหนทีมงานปิดเรื่องแล้ว
  const messages = await query<MessageRow>(
    `select id, topic, message, created_at, resolved_at
       from contact_messages where org_id = $1
      order by created_at desc limit 20`,
    [ctx.org.id],
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ติดต่อทีมงาน</h1>
        <p className="text-sm text-[var(--muted)]">
          แจ้งปัญหา สอบถามแพ็กเกจ หรือขอเปิดการเชื่อมต่อ — ทีมงานติดต่อกลับทางอีเมลที่ใช้สมัคร
        </p>
      </div>

      <ContactClient />

      {messages.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold">ข้อความที่เคยส่ง</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {messages.map((m) => (
              <li key={m.id} className="border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{m.topic}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      m.resolved_at
                        ? "bg-green-50 text-green-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {m.resolved_at ? "ปิดเรื่องแล้ว" : "รอทีมงาน"}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[var(--muted)]">{m.message}</p>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  {formatDateTime(m.created_at)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
