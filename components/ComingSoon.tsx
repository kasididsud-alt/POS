export default function ComingSoon({
  title,
  icon,
  description,
}: {
  title: string;
  icon: string;
  description?: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="card mt-6 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="text-5xl">{icon}</div>
        <div className="mt-4 inline-block rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
          เร็วๆ นี้
        </div>
        <p className="mt-3 max-w-md text-sm text-[var(--muted)]">
          {description ??
            "ฟีเจอร์นี้อยู่ในแผนพัฒนา — โครงเมนูพร้อมแล้ว รอเติมรายละเอียดการทำงาน"}
        </p>
      </div>
    </div>
  );
}
