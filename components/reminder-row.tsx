"use client";

import { Bell, CalendarDays, Cake, Heart, MapPin, Receipt, Repeat, Users, type LucideIcon } from "lucide-react";
import { diffDays, relativeDayLabel } from "@/lib/dates";
import type { Reminder } from "@/lib/db/schema";
import { formatTime, kindMeta, milestoneLabel, type Kind } from "@/lib/reminder-schedule";
import { cn } from "./ui";

export const KIND_ICON: Record<Kind, LucideIcon> = {
  birthday: Cake,
  anniversary: Heart,
  event: CalendarDays,
  meeting: Users,
  bill: Receipt,
  other: Bell,
};

export function KindIcon({ kind, className }: { kind: string; className?: string }) {
  const meta = kindMeta(kind);
  const I = KIND_ICON[kind as Kind] ?? Bell;
  return (
    <span
      className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", className)}
      style={{ background: `color-mix(in srgb, ${meta.color} 16%, transparent)`, color: meta.color }}
    >
      <I className="size-5" aria-hidden />
    </span>
  );
}

function countdown(occ: string, today: string) {
  const d = diffDays(occ, today);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  return d > 0 ? `in ${d} days` : `${-d} days ago`;
}

/** One occurrence of a reminder. `occ` is the date being shown (for repeating reminders, not the start date). */
export function ReminderRow({
  reminder: r,
  occ,
  today,
  onOpen,
  showDate = true,
}: {
  reminder: Reminder;
  occ: string;
  today: string;
  onOpen?: () => void;
  showDate?: boolean;
}) {
  const milestone = milestoneLabel(r, occ);
  const soon = diffDays(occ, today);
  const Tag = onOpen ? "button" : "div";
  return (
    <Tag
      {...(onOpen ? { type: "button" as const, onClick: onOpen } : {})}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-3 text-left",
        onOpen && "transition-colors hover:bg-surface-2 active:bg-surface-2",
      )}
    >
      <KindIcon kind={r.kind} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium sm:text-sm">{r.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-text-3">
          {showDate && <span>{relativeDayLabel(occ, today)}</span>}
          <span>{r.time ? formatTime(r.time) : "All day"}</span>
          {r.repeat !== "none" && <Repeat className="size-3" aria-label="Repeats" />}
          {r.location && (
            <span className="inline-flex min-w-0 items-center gap-0.5">
              <MapPin className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{r.location}</span>
            </span>
          )}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        {milestone && (
          <span className="text-xs font-semibold" style={{ color: kindMeta(r.kind).color }}>
            {milestone}
          </span>
        )}
        <span className={cn("text-xs", soon === 0 ? "font-semibold text-accent" : "text-text-3")}>{countdown(occ, today)}</span>
      </span>
    </Tag>
  );
}
