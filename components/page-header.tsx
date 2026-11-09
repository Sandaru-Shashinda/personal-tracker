import { chipColor, sectionByLabel } from "./sections";

export function PageHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const section = sectionByLabel(title);
  const I = section?.icon;
  return (
    <div className="animate-rise mb-5 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
      <div className="flex min-w-0 items-center gap-3">
        {section && I && (
          <span
            className="chip-solid flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-md shadow-black/10"
            style={chipColor(section.color)}
            aria-hidden
          >
            <I className="size-[22px]" strokeWidth={2.1} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight font-bold tracking-tight sm:text-3xl">{title}</h1>
          {sub && <p className="mt-0.5 text-sm text-text-3">{sub}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
