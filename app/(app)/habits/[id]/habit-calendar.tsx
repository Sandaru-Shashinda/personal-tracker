"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { Button, cn } from "@/components/ui";
import { logHabit } from "@/lib/actions/habits";
import { addDays, parseDay, startOfWeek, WEEKDAY_SHORT } from "@/lib/dates";
import type { Habit } from "@/lib/db/schema";
import { isScheduled } from "@/lib/stats";

export function HabitCalendar({
  habit,
  logs,
  today,
  weekStartsOn,
}: {
  habit: Habit;
  logs: Record<string, number>;
  today: string;
  weekStartsOn: number;
}) {
  const toast = useToast();
  const [, start] = useTransition();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [values, setValue] = useOptimistic(logs, (s, [d, v]: [string, number]) => ({ ...s, [d]: v }));

  const first = `${month}-01`;
  const gridStart = startOfWeek(first, weekStartsOn);
  const [y, m] = month.split("-").map(Number);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const monthDone = cells.filter((d) => d.startsWith(month) && (values[d] ?? 0) >= habit.target).length;

  function click(d: string) {
    if (d > today) return;
    const cur = values[d] ?? 0;
    let next: number;
    if (habit.type === "check") next = cur >= 1 ? 0 : 1;
    else {
      const input = prompt(`${habit.title} on ${d} (${habit.unit ?? "value"}, target ${habit.target})`, String(cur || habit.target));
      if (input === null) return;
      next = Number(input);
      if (!Number.isFinite(next) || next < 0) return toast("Enter a number", "bad");
    }
    start(async () => {
      setValue([d, next]);
      try {
        await logHabit(habit.id, d, next);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Couldn't save", "bad");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">
            {parseDay(first).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
          </h2>
          <p className="text-xs text-text-3">{monthDone} completions · click a day to edit</p>
        </div>
        <div className="flex gap-1">
          <Button size="icon" onClick={() => shift(-1)} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <Button size="icon" onClick={() => shift(1)} disabled={month >= today.slice(0, 7)} aria-label="Next month">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-text-3">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="pb-1">
            {WEEKDAY_SHORT[(weekStartsOn + i) % 7]}
          </span>
        ))}
        {cells.map((d) => {
          const inMonth = d.startsWith(month);
          const v = values[d] ?? 0;
          const done = v >= habit.target;
          const partial = !done && v > 0;
          const sched = isScheduled(habit, d);
          const future = d > today;
          return (
            <button
              key={d}
              type="button"
              disabled={future}
              onClick={() => click(d)}
              aria-label={`${d}: ${done ? "done" : partial ? `${v} of ${habit.target}` : "not done"}`}
              aria-pressed={done}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-lg text-sm transition",
                !inMonth && "opacity-30",
                future ? "cursor-default text-text-3" : "hover:ring-2 hover:ring-border",
                !done && sched && !future && d >= habit.startDate && "bg-surface-2",
                d === today && !done && "ring-2 ring-accent",
              )}
              style={done ? { background: habit.color, color: "white" } : undefined}
            >
              {done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : Number(d.slice(8))}
              {partial && (
                <span
                  className="absolute inset-x-1.5 bottom-1 h-1 rounded-full"
                  style={{ background: `linear-gradient(to right, ${habit.color} ${(v / habit.target) * 100}%, var(--border) 0)` }}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
