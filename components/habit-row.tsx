"use client";

import { Check, Flame, Minus, MessageSquare, Plus } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { logHabit } from "@/lib/actions/habits";
import { WEEKDAY_SHORT, dayOfWeek } from "@/lib/dates";
import type { HabitDayView } from "@/lib/view";
import { Icon } from "./icons";
import { useToast } from "./toast";
import { cn } from "./ui";

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function HabitRow({
  view,
  date,
  categoryName,
  note,
}: {
  view: HabitDayView;
  date: string;
  categoryName?: string;
  note?: string;
}) {
  const { habit } = view;
  const toast = useToast();
  const [, start] = useTransition();
  const [value, setOptimistic] = useOptimistic(view.value);
  const [popKey, setPopKey] = useState(0);
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState(note ?? "");
  const done = value >= habit.target;
  const pct = Math.min(1, value / habit.target);

  function commit(next: number, n?: string | null) {
    const v = Math.max(0, Math.round(next * 100) / 100);
    if (v >= habit.target && value < habit.target) setPopKey((k) => k + 1);
    start(async () => {
      setOptimistic(v);
      try {
        await logHabit(habit.id, date, v, n);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Couldn't save", "bad");
      }
    });
  }

  const step = habit.target >= 20 ? Math.round(habit.target / 10) : 1;
  const streakLabel = view.streak.current
    ? `${view.streak.current} ${view.streak.unit === "weeks" ? "wk" : "day"}${view.streak.current === 1 ? "" : "s"}`
    : null;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-surface shadow-card transition-colors",
        done && "bg-surface-2/60",
      )}
    >
      {habit.type === "count" && (
        <div
          className="absolute inset-y-0 left-0 opacity-[0.09] transition-[width] duration-300"
          style={{ width: `${pct * 100}%`, background: habit.color }}
          aria-hidden
        />
      )}
      <div className="relative flex items-center gap-2.5 p-3 sm:gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ background: habit.color }}
        >
          <Icon name={habit.icon} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/habits/${habit.id}`}
              className={cn("truncate font-medium hover:underline", done && "text-text-2 line-through decoration-text-3")}
            >
              {habit.title}
            </Link>
            {streakLabel && (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-warn" title="Current streak">
                <Flame className="size-3.5" aria-hidden />
                {streakLabel}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-text-3">
            {habit.type === "count" && (
              <span className="tabular font-medium text-text-2">
                {fmt(value)} / {fmt(habit.target)} {habit.unit}
              </span>
            )}
            {habit.frequency === "weekly" && (
              <span>
                {view.weekDone}/{habit.timesPerWeek} this week
              </span>
            )}
            {habit.frequency === "days" && <span>{habit.daysOfWeek.map((d) => WEEKDAY_SHORT[d][0]).join(" ")}</span>}
            {categoryName && <span>{categoryName}</span>}
            <span className="hidden items-center gap-0.5 sm:inline-flex" aria-label="Last 7 days">
              {view.last7.map((d) => (
                <span
                  key={d.date}
                  title={`${WEEKDAY_SHORT[dayOfWeek(d.date)]}: ${d.done ? "done" : d.scheduled ? "missed" : "not due"}`}
                  className={cn("size-1.5 rounded-full", !d.done && (d.scheduled ? "bg-border" : "bg-transparent ring-1 ring-border"))}
                  style={d.done ? { background: habit.color } : undefined}
                />
              ))}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowNote((s) => !s)}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg text-text-3 hover:bg-surface-2 hover:text-text active:bg-surface-2 sm:size-8",
            !note && !showNote && "can-hover:opacity-0 can-hover:group-hover:opacity-100 can-hover:focus:opacity-100",
          )}
          aria-label="Add note"
          title={note || "Add note"}
        >
          <MessageSquare className={cn("size-4", note && "fill-current")} aria-hidden />
        </button>

        {habit.type === "count" ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => commit(value - step)}
              disabled={value <= 0}
              className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface shadow-card hover:bg-surface-2 active:scale-95 disabled:opacity-40 sm:size-9 sm:rounded-lg"
              aria-label={`Decrease ${habit.title}`}
            >
              <Minus className="size-4" aria-hidden />
            </button>
            <button
              key={popKey}
              type="button"
              onClick={() => commit(value + step)}
              className={cn(
                "flex size-10 items-center justify-center rounded-xl text-white transition-transform active:scale-95 sm:size-9 sm:rounded-lg",
                popKey > 0 && "animate-pop",
              )}
              style={{ background: habit.color }}
              aria-label={`Increase ${habit.title}`}
            >
              {done ? <Check className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            </button>
          </div>
        ) : (
          <button
            key={popKey}
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={`Mark ${habit.title} ${done ? "not done" : "done"}`}
            onClick={() => commit(done ? 0 : 1)}
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full border-2 transition-[color,background-color,border-color,transform] active:scale-90 sm:size-10",
              done ? "border-transparent text-white" : "border-border text-transparent hover:border-text-3",
              popKey > 0 && "animate-pop",
            )}
            style={done ? { background: habit.color } : undefined}
          >
            <Check className="size-5" strokeWidth={3} aria-hidden />
          </button>
        )}
      </div>
      {showNote && (
        <form
          className="relative flex gap-2 border-t border-border px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            commit(value, noteText.trim() || null);
            setShowNote(false);
          }}
        >
          <input
            autoFocus
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="How did it go?"
            className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-text-3"
          />
          <button type="submit" className="px-2 text-sm font-medium text-accent">
            Save
          </button>
        </form>
      )}
    </div>
  );
}
