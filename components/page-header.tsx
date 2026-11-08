export function PageHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight sm:text-3xl sm:font-semibold">{title}</h1>
        {sub && <p className="mt-1 text-sm text-text-3">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
