"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { createApiKey, revokeApiKey } from "./actions";

type Key = {
  id: string;
  name: string;
  prefix: string;
  last_used_at: string | null;
  created_at: string;
};

export default function ApiKeysClient({ keys }: { keys: Key[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function onCreate(fd: FormData) {
    setErr(null);
    setNewKey(null);
    start(async () => {
      const res = await createApiKey(fd);
      if (!res.ok) setErr(res.error ?? "ผิดพลาด");
      else {
        setNewKey(res.key ?? null);
        router.refresh();
      }
    });
  }

  function onRevoke(id: string) {
    if (!confirm("ยกเลิก API key นี้? แอปที่ใช้อยู่จะเข้าถึงไม่ได้ทันที")) return;
    start(async () => {
      await revokeApiKey(id);
      router.refresh();
    });
  }

  return (
    <div className="card p-5">
      <h2 className="font-semibold">API Keys</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        เข้าถึงข้อมูลร้านผ่าน REST API — เช่น{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
          GET /api/v1/products
        </code>{" "}
        พร้อม header{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
          Authorization: Bearer &lt;key&gt;
        </code>
      </p>

      {newKey && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
          <div className="font-medium text-green-800">
            สร้างสำเร็จ — คัดลอกเก็บไว้เดี๋ยวนี้ (จะไม่แสดงอีก)
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-white px-2 py-1.5 text-xs">
              {newKey}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newKey);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="btn-outline shrink-0 px-3 py-1.5 text-xs"
            >
              {copied ? "คัดลอกแล้ว ✓" : "คัดลอก"}
            </button>
          </div>
        </div>
      )}

      {err && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      <form action={onCreate} className="mt-4 flex flex-wrap gap-2">
        <input
          name="name"
          placeholder="ชื่อ key (เช่น ระบบบัญชี)"
          className="input flex-1"
        />
        <button disabled={pending} className="btn-primary">
          สร้าง API key
        </button>
      </form>

      <div className="mt-4 divide-y divide-[var(--border)]">
        {keys.length === 0 && (
          <p className="py-3 text-sm text-[var(--muted)]">ยังไม่มี API key</p>
        )}
        {keys.map((k) => (
          <div key={k.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <div className="truncate font-medium">{k.name}</div>
              <div className="text-xs text-[var(--muted)]">
                <code>{k.prefix}…</code> · สร้าง {formatDateTime(k.created_at)} ·{" "}
                {k.last_used_at
                  ? `ใช้ล่าสุด ${formatDateTime(k.last_used_at)}`
                  : "ยังไม่เคยใช้"}
              </div>
            </div>
            <button
              onClick={() => onRevoke(k.id)}
              disabled={pending}
              className="shrink-0 text-xs text-red-600"
            >
              ยกเลิก
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
