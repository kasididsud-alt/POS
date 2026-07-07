"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { navGroupsFor, type PlanTier } from "./nav";

export default function Sidebar({
  shopName,
  role,
  plan,
  alertCount = 0,
}: {
  shopName: string;
  role: string;
  plan: PlanTier;
  alertCount?: number;
}) {
  const pathname = usePathname();
  const groups = navGroupsFor(role, plan);
  // กลุ่มที่เปิดอยู่ (เริ่มต้นเปิดทุกกลุ่ม)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--border)] bg-white md:flex">
      <Link
        href="/dashboard"
        className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-4 text-lg font-bold"
      >
        <span>🧾</span> ขายดี Stock
      </Link>
      <div className="truncate px-5 py-3 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {shopName}
      </div>

      <nav className="flex-1 space-y-3 overflow-y-auto px-3 pb-6">
        {groups.map((group) => {
          const isCollapsed = collapsed[group.title];
          return (
            <div key={group.title}>
              <button
                onClick={() =>
                  setCollapsed((c) => ({ ...c, [group.title]: !c[group.title] }))
                }
                className="flex w-full items-center justify-between px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600"
              >
                {group.title}
                <span className="text-[10px]">{isCollapsed ? "▸" : "▾"}</span>
              </button>
              {!isCollapsed && (
                <div className="mt-1 space-y-0.5">
                  {group.items.map((item) => {
                    const active =
                      pathname === item.href ||
                      pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                          active
                            ? "bg-indigo-50 font-medium text-[var(--primary)]"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <span>{item.icon}</span>
                        <span className="flex-1">{item.label}</span>
                        {item.href === "/alerts" && alertCount > 0 && (
                          <span
                            aria-label={`มี ${alertCount} รายการที่ต้องจัดการ`}
                            className="min-w-[1.25rem] rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white"
                          >
                            {alertCount > 99 ? "99+" : alertCount}
                          </span>
                        )}
                        {item.soon && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">
                            เร็วๆนี้
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
