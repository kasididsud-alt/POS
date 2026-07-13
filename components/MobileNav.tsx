"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_NAV, roleAllowsPath, planAllowsPath, type PlanTier } from "./nav";

export default function MobileNav({
  role,
  plan,
}: {
  role: string;
  plan: PlanTier;
}) {
  const pathname = usePathname();
  const items = MOBILE_NAV.filter(
    (i) => roleAllowsPath(role, i.href) && planAllowsPath(plan, i.href),
  );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[var(--border)] bg-white md:hidden">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
              active ? "text-[var(--primary)]" : "text-slate-500"
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
