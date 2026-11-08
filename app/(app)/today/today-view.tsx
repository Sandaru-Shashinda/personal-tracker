"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Plus, Repeat } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HabitForm } from "@/components/habit-form";
import { HabitRow } from "@/components/habit-row";
import { EnergyPicker, MoodPicker } from "@/components/mood";
import { TaskRow } from "@/components/task-row";
import { useToast } from "@/components/toast";
import { Button, Card, CardTitle, Empty, Modal, Textarea } from "@/components/ui";
import { saveJournalEntry } from "@/lib/actions/journal";
import { createTask } from "@/lib/actions/tasks";
import { addDays, prettyDay } from "@/lib/dates";
import type { Category, Task } from "@/lib/db/schema";
import type { HabitDayView } from "@/lib/view";

export function TodayView({
  date,
  today,
  name,
  views,
  notes,
  categories,
  tasks,
  entry,
}: {
  date: string;
  today: string;
  name: string;
  views: HabitDayView[];
  notes: Record<string, string>;
  categories: Category[];
  tasks: Task[];
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-text-3" suppressHydrationWarning>
            {isToday ? `${greeting}, ${name.split(" ")[0]}` : "Looking back"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {isToday ? "Today" : prettyDay(date, { weekday: "long" })}
            <span className="ml-2 text-base font-normal text-text-3">
              {prettyDay(date, { weekday: isToday ? "long" : undefined, year: "numeric" })}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="icon" onClick={() => go(addDays(date, -1))} aria-label="Previous day">
            <ChevronLeft className="size-4" />
          </Button>
          {!isToday && (
            <Button variant="secondary" size="sm" onClick={() => go(today)}>
              Today
            </Button>
          )}
          <Button
            variant="secondary"
            size="icon"
            onClick={() => go(addDays(date, 1))}
            disabled={isToday}
            aria-label="Next day"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

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
                className="h-9 flex-1 rounded-lg border border-border bg-surface-2 px-3 text-sm outline-none placeholder:text-text-3 focus:border-accent"
              />
              <Button type="submit" size="icon" variant="primary" aria-label="Add task">
                <Plus className="size-4" />
              </Button>
            </form>
            <div className="divide-y divide-border pb-1">
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
