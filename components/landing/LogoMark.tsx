// โมโนแกรม "ข" บนป้ายน้ำเงินกรมท่าและจุดมิ้นต์ ใช้ได้ทั้งพื้นสว่างและเข้ม
export default function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`relative grid shrink-0 place-items-center rounded-xl border border-white/15 bg-[var(--lp-night,#06152b)] ${className}`}
    >
      <span className="lp-display text-lg font-bold leading-none text-white">ข</span>
      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[var(--lp-mint,#42e6ad)]" />
    </span>
  );
}
