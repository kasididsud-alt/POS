export default function PlanBadge({ plan }: { plan: string }) {
  const style =
    plan === "premium"
      ? "bg-amber-100 text-amber-800"
      : plan === "pro"
        ? "bg-indigo-100 text-indigo-800"
        : "bg-slate-100 text-slate-600";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${style}`}
    >
      {plan}
    </span>
  );
}
