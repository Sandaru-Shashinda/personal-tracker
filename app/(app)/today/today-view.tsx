"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Plus, Repeat } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HabitForm } from "@/components/habit-form";
import { HabitRow } from "@/components/habit-row";
import { ReminderRow } from "@/components/reminder-row";
import { EnergyPicker, MoodPicker } from "@/components/mood";
import { TaskRow } from "@/components/task-row";
import { useToast } from "@/components/toast";
import { Button, Card, CardTitle, cn, Empty, Modal, Textarea } from "@/components/ui";
import { saveJournalEntry } from "@/lib/actions/journal";
import { createTask } from "@/lib/actions/tasks";
import { WEEKDAY_SHORT, addDays, dayOfWeek, prettyDay } from "@/lib/dates";
import type { Category, Reminder, Task } from "@/lib/db/schema";
import { occurrencesBetween } from "@/lib/reminder-schedule";
import type { HabitDayView } from "@/lib/view";

export function TodayView({
  date,
  today,
  name,
  views,
  notes,
  categories,
  tasks,
  reminders,
  entry,
}: {
  date: string;
  today: string;
  name: string;
  views: HabitDayView[];
  notes: Record<string, string>;
  categories: Category[];
  tasks: Task[];
  reminders: Reminder[];
  entry: { mood: number | null; energy: number | null; content: string } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();
  const [habitOpen, setHabitOpen] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [quick, setQuick] = useState("");
  const [mood, setMood] = useState(entry?.mood ?? null);
  const [energy, setEnergy] = useState(entry?.energy ?? null);
  const [note, setNote] = useState(entry?.content ?? "");
  const [noteDirty, setNoteDirty] = useState(false);
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const catById = new Map(categories.map((c) => [c.id, c]));

  const due = views.filter((v) => v.scheduled || v.done);
  const other = views.filter((v) => !v.scheduled && !v.done);
  const doneCount = due.filter((v) => v.done).length;
  const pct = due.length ? doneCount / due.length : 0;
  const isToday = date === today;
  // Reminders on this day and the next 6, soonest first.
  const comingUp = reminders
    .flatMap((r) => occurrencesBetween(r, date, addDays(date, 6)).slice(0, 1).map((occ) => ({ r, occ })))
    .sort((a, b) => a.occ.localeCompare(b.occ) || (a.r.time ?? "").localeCompare(b.r.time ?? ""))
    .slice(0, 5);

  const go = (d: string) => router.push(d === today ? "/today" : `/today?date=${d}`);

  const saveMood = (patch: { mood?: number | null; energy?: number | null; content?: string }) =>
    start(async () => {
      try {
        await saveJournalEntry({ date, ...patch });
      } catch {
        toast("Couldn't save", "bad");
      }
    });

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  })();

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-text-3" suppressHydrationWarning>
              {isToday ? `${greeting}, ${name.split(" ")[0]}` : "Looking back"}
            </p>
            <h1 className="text-[28px] leading-tight font-bold tracking-tight sm:text-3xl sm:font-semibold">
              {isToday ? "Today" : prettyDay(date, { weekday: "long" }).split(",")[0]}
            </h1>
            <p className="text-sm text-text-3">{prettyDay(date, { weekday: "long", year: "numeric" })}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!isToday && (
              <Button variant="secondary" size="sm" onClick={() => go(today)}>
                Today
              </Button>
            )}
            <Button variant="secondary" size="icon" onClick={() => go(addDays(date, -1))} aria-label="Previous day" className="max-sm:hidden">
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => go(addDays(date, 1))}
              disabled={isToday}
              aria-label="Next day"
              className="max-sm:hidden"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        <WeekStrip date={date} today={today} onPick={go} />
      </header>

      {/* progress summary */}
      <Card className="flex items-center gap-5">
        <ProgressRing pct={pct} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold">
            {due.length === 0
              ? "Nothing scheduled"
              : doneCount === due.length
                ? "All done. Great work! 🎉"
                : `${doneCount} of ${due.length} habits done`}
          </p>
          <p className="text-sm text-text-3">
            {tasks.filter((t) => !t.completedAt).length} open tasks due
            {mood ? " · mood logged" : " · how are you feeling?"}
          </p>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section aria-labelledby="habits-h" className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="habits-h" className="font-semibold">
              Habits
            </h2>
            <Button size="sm" variant="ghost" onClick={() => setHabitOpen(true)}>
              <Plus className="size-4" /> New habit
            </Button>
          </div>
          {views.length === 0 ? (
            <Empty icon={<Repeat className="size-8" />} title="No habits yet">
              <button className="font-medium text-accent hover:underline" onClick={() => setHabitOpen(true)}>
                Create your first habit
              </button>{" "}
              to start tracking daily.
            </Empty>
          ) : (
            <div className="space-y-2">
              {due.map((v) => (
                <HabitRow
                  key={v.habit.id}
                  view={v}
                  date={date}
                  note={notes[v.habit.id]}
                  categoryName={v.habit.categoryId ? catName.get(v.habit.categoryId) : undefined}
                />
              ))}
              {due.length === 0 && (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-text-3">
                  No habits are due {isToday ? "today" : "this day"}.
                </p>
              )}
              {other.length > 0 && (
                <div className="pt-2">
                  <button
                    onClick={() => setShowOther((s) => !s)}
                    className="flex items-center gap-1 text-sm text-text-3 hover:text-text"
                    aria-expanded={showOther}
                  >
                    <ChevronDown className={`size-4 transition-transform ${showOther ? "" : "-rotate-90"}`} />
                    Not due {isToday ? "today" : "this day"} ({other.length})
                  </button>
                  {showOther && (
                    <div className="mt-2 space-y-2 opacity-80">
                      {other.map((v) => (
                        <HabitRow key={v.habit.id} view={v} date={date} note={notes[v.habit.id]} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        <div className="space-y-6">
          {comingUp.length > 0 && (
            <Card className="p-0 sm:p-0">
              <div className="flex items-center justify-between px-4 pt-4 pb-1">
                <h2 className="font-semibold">Coming up</h2>
                <Link href="/reminders" className="text-sm text-accent hover:underline">
                  All reminders
                </Link>
              </div>
              <div className="divide-y divide-border px-1 pb-1">
                {comingUp.map(({ r, occ }) => (
                  <Link key={r.id} href={`/reminders?date=${occ}`} className="block">
                    <ReminderRow reminder={r} occ={occ} today={today} />
                  </Link>
                ))}
              </div>
            </Card>
          )}
          <Card className="p-0 sm:p-0">
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <h2 className="font-semibold">Tasks</h2>
              <Link href="/tasks" className="text-sm text-accent hover:underline">
                All tasks
              </Link>
            </div>
            <form
              className="flex gap-2 px-4 pb-2"
              onSubmit={(e) => {
                e.preventDefault();
                const title = quick.trim();
                if (!title) return;
                setQuick("");
                start(async () => {
                  const r = await createTask({ title, dueDate: date });
                  if (!r.ok) toast(r.error, "bad");
                });
              }}
            >
              <input
                value={quick}
                onChange={(e) => setQuick(e.target.value)}
                placeholder="Quick add a task for this day…"
                className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 text-sm outline-none placeholder:text-text-3 focus:border-accent sm:h-9"
              />
              <Button type="submit" size="icon" variant="primary" aria-label="Add task">
                <Plus className="size-4" />
              </Button>
            </form>
            <div className="divide-y divide-border px-1 pb-1">
              {tasks.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-text-3">Nothing due. Enjoy the free time.</p>
              ) : (
                tasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    today={today}
                    compact
                    category={t.categoryId ? catById.get(t.categoryId) : undefined}
                  />
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardTitle
              action={
                <Link href={`/journal?date=${date}`} className="text-sm text-accent hover:underline">
                  Journal
                </Link>
              }
            >
              How are you feeling?
            </CardTitle>
            <MoodPicker
              value={mood}
              onChange={(m) => {
                setMood(m);
                saveMood({ mood: m });
              }}
            />
            <p className="mb-1.5 mt-4 text-xs font-medium text-text-2">Energy</p>
            <EnergyPicker
              value={energy}
              onChange={(e) => {
                setEnergy(e);
                saveMood({ energy: e });
              }}
            />
            <Textarea
              rows={3}
              className="mt-4"
              placeholder="A quick note about the day…"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setNoteDirty(true);
              }}
              onBlur={() => {
                if (noteDirty) {
                  saveMood({ content: note });
                  setNoteDirty(false);
                  toast("Note saved");
                }
              }}
            />
          </Card>
        </div>
      </div>

      <Modal open={habitOpen} onClose={() => setHabitOpen(false)} title="New habit" wide>
        <HabitForm categories={categories} onDone={() => setHabitOpen(false)} />
      </Modal>
    </div>
  );
}

/** A week of days to jump between with one tap. Ends on today, or a few days after the selected day. */
function WeekStrip({ date, today, onPick }: { date: string; today: string; onPick: (d: string) => void }) {
  const ahead = addDays(date, 3);
  const end = ahead > today ? today : ahead;
  const days = Array.from({ length: 7 }, (_, i) => addDays(end, i - 6));
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onPick(addDays(days[0], -1))}
        aria-label="Earlier days"
        className="flex h-14 w-7 shrink-0 items-center justify-center rounded-lg text-text-3 active:bg-surface-2 sm:hidden"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <div className="grid flex-1 grid-cols-7 gap-1 sm:max-w-md" role="tablist" aria-label="Pick a day">
        {days.map((d) => {
          const sel = d === date;
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={sel}
              aria-label={prettyDay(d, { weekday: "long" })}
              onClick={() => !sel && onPick(d)}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors",
                sel ? "border-transparent bg-accent text-accent-fg" : "border-border bg-surface text-text active:bg-surface-2",
              )}
            >
              <span className={cn("text-[11px] font-medium", sel ? "text-accent-fg/80" : "text-text-3")}>
                {WEEKDAY_SHORT[dayOfWeek(d)].slice(0, 2)}
              </span>
              <span className="tabular text-base leading-none font-semibold">{Number(d.slice(8))}</span>
              <span
                className={cn("size-1 rounded-full", d === today ? (sel ? "bg-accent-fg" : "bg-accent") : "bg-transparent")}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-16 shrink-0" role="img" aria-label={`${Math.round(pct * 100)}% complete`}>
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--grid)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="var(--series-1)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="tabular absolute inset-0 flex items-center justify-center text-sm font-semibold">
        {Math.round(pct * 100)}%
      </span>
    </div>
  );
}
