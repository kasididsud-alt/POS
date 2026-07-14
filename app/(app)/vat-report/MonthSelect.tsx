"use client";

import { useRouter } from "next/navigation";

/** dropdown เลือกงวดเดือน — เปลี่ยนแล้วพาไปงวดนั้นทันที (คงมุมมองเดิมไว้) */
export default function MonthSelect({
  months,
  current,
  view,
}: {
  months: { value: string; label: string }[];
  current: string;
  view: "daily" | "inv";
}) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-[var(--muted)]">งวดเดือน</span>
      <select
        value={current}
        onChange={(e) =>
          router.push(
            `/vat-report?m=${e.target.value}${view === "inv" ? "&v=inv" : ""}`,
          )
        }
        className="input w-auto min-w-36 cursor-pointer"
      >
        {months.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
    </label>
  );
}
