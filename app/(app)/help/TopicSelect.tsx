"use client";

import { useRouter } from "next/navigation";
import type { HelpGroup } from "./topics";

/** dropdown เลือกหัวข้อคู่มือ (ใช้บนจอเล็กแทนเมนูซ้าย) */
export default function TopicSelect({
  groups,
  current,
}: {
  groups: HelpGroup[];
  current: string;
}) {
  const router = useRouter();
  return (
    <select
      value={current}
      onChange={(e) => router.push(`/help?t=${e.target.value}`)}
      className="input cursor-pointer"
    >
      {groups.map((g) => (
        <optgroup key={g.title} label={g.title}>
          {g.topics.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.icon} {t.title}
              {t.image ? " 📷" : ""}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
