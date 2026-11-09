"use client";

import {
  AlarmClock,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  Flame,
  Plus,
  Repeat,
  Sparkles,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HabitForm } from "@/components/habit-form";
import { HabitRow } from "@/components/habit-row";
import { ReminderRow } from "@/components/reminder-row";
import { EnergyPicker, MoodPicker } from "@/components/mood";
import { TaskRow } from "@/components/task-row";
import { chipColor, SECTIONS, type Section } from "@/components/sections";
import { useToast } from "@/components/toast";
import { Button, Card, CardTitle, cn, Empty, Modal, Textarea } from "@/components/ui";
import { saveJournalEntry } from "@/lib/actions/journal";
import { createTask } from "@/lib/actions/tasks";
import { WEEKDAY_SHORT, addDays, dayOfWeek, diffDays, prettyDay } from "@/lib/dates";
import type { Category, Reminder, Task } from "@/lib/db/schema";
import { occurrencesBetween } from "@/lib/reminder-schedule";
import type { GoalSummary, HotItem, HotKind } from "@/lib/today";
import type { HabitDayView } from "@/lib/view";

/** How far ahead "Coming up" looks for reminders. */
const UPCOMING_DAYS = 30;

export function TodayView({
  date,
  today,
  name,
  views,
  notes,
  categories,
  tasks,
  reminders,
  goals,
  hot,
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
  goals: GoalSummary[];
  hot: HotItem[];
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
  // Next occurrence of each reminder over the coming month, soonest first. On today, today's
  // reminders already sit in "Hot right now", so this starts tomorrow.
  const upFrom = isToday ? addDays(date, 1) : date;
  const comingUp = reminders
    .flatMap((r) => occurrencesBetween(r, upFrom, addDays(date, UPCOMING_DAYS)).slice(0, 1).map((occ) => ({ r, occ })))
    .sort((a, b) => a.occ.localeCompare(b.occ) || (a.r.time ?? "").localeCompare(b.r.time ?? ""))
    .slice(0, 6);

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
      <header className="animate-rise space-y-3">
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
      <section className="bg-brand animate-rise relative isolate flex items-center gap-5 overflow-hidden rounded-3xl p-5 shadow-xl shadow-accent/25 sm:p-6">
        <div className="absolute -top-16 -right-10 -z-10 size-48 rounded-full bg-white/15 blur-2xl" aria-hidden />
        <div className="absolute -bottom-20 left-1/3 -z-10 size-40 rounded-full bg-fuchsia-300/20 blur-2xl" aria-hidden />
        <ProgressRing pct={pct} />
        <div className="min-w-0 flex-1">
          <p className="text-lg leading-snug font-semibold sm:text-xl">
            {due.length === 0
              ? "Nothing scheduled"
              : doneCount === due.length
                ? "All done. Great work! 🎉"
                : `${doneCount} of ${due.length} habits done`}
          </p>
          <p className="mt-1 text-sm text-white/80">
            {tasks.filter((t) => !t.completedAt).length} open tasks due
            {mood ? " · mood logged" : " · how are you feeling?"}
          </p>
        </div>
        <Sparkles className="hidden size-8 shrink-0 text-white/40 sm:block" aria-hidden />
      </section>

      {isToday && <HotCard items={hot} />}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section aria-labelledby="habits-h" className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <SectionTitle id="habits-h" section={SECTIONS.habits}>
              Habits
            </SectionTitle>
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
            <div className="flex items-center justify-between px-4 pt-4 pb-1">
              <SectionTitle section={SECTIONS.reminders}>Upcoming reminders</SectionTitle>
              <Link href="/reminders" className="text-sm text-accent hover:underline">
                All reminders
              </Link>
            </div>
            {comingUp.length === 0 ? (
              <p className="px-4 pt-2 pb-5 text-center text-sm text-text-3">
                Nothing in the next {UPCOMING_DAYS} days.{" "}
                <Link href="/reminders" className="font-medium text-accent hover:underline">
                  Add a reminder
                </Link>
              </p>
            ) : (
              <div className="divide-y divide-border px-1 pb-1">
                {comingUp.map(({ r, occ }) => (
                  <Link key={r.id} href={`/reminders?date=${occ}`} className="block">
                    <ReminderRow reminder={r} occ={occ} today={today} />
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <GoalsCard goals={goals} today={today} />
          <Card className="p-0 sm:p-0">
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <SectionTitle section={SECTIONS.tasks}>Tasks</SectionTitle>
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
                className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none placeholder:text-text-3 focus:border-accent focus:bg-surface focus:ring-4 focus:ring-accent/15 sm:h-9"
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
              <span className="flex items-center gap-2">
                <SectionChip section={SECTIONS.journal} />
                How are you feeling?
              </span>
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

const HOT_ICON: Record<HotKind, LucideIcon> = {
  overdue: AlarmClock,
  reminder: Bell,
  streak: Flame,
  goal: Flag,
  priority: Zap,
  budget: Wallet,
};

const TONE_TEXT = { bad: "text-bad", warn: "text-warn", accent: "text-accent" } as const;
const TONE_VAR = { bad: "var(--bad)", warn: "var(--warn)", accent: "var(--accent)" } as const;
const HOT_LIMIT = 6;

/** Things that need attention right now: overdue work, today's events, streaks and deadlines at risk. */
function HotCard({ items }: { items: HotItem[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, HOT_LIMIT);
  return (
    <section aria-labelledby="hot-h">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-bad/15 text-bad">
          <Flame className="size-4" aria-hidden />
        </span>
        <h2 id="hot-h" className="font-semibold">
          Hot right now
        </h2>
        {items.length > 0 && (
          <span className="tabular rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-2">{items.length}</span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 rounded-2xl border border-border bg-surface shadow-card px-4 py-3 text-sm text-text-2">
          <CheckCircle2 className="size-4 shrink-0 text-good" aria-hidden />
          Nothing urgent. No overdue tasks, deadlines or streaks at risk.
        </p>
      ) : (
        <>
          <ul className="grid gap-2 sm:grid-cols-2">
            {shown.map((it) => {
              const I = HOT_ICON[it.kind];
              return (
                <li key={it.key}>
                  <Link
                    href={it.href}
                    className="flex h-full items-center gap-3 rounded-xl border border-border bg-surface shadow-card px-3 py-2.5 transition-colors hover:bg-surface-2 active:bg-surface-2"
                    style={{ borderLeft: `3px solid ${TONE_VAR[it.tone]}` }}
                  >
                    <span
                      className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TONE_TEXT[it.tone])}
                      style={{ background: `color-mix(in srgb, ${TONE_VAR[it.tone]} 14%, transparent)` }}
                    >
                      <I className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium sm:text-sm">{it.title}</span>
                      <span className="block truncate text-xs text-text-3">{it.detail}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
          {items.length > HOT_LIMIT && (
            <button
              type="button"
              onClick={() => setAll((a) => !a)}
              className="mt-2 text-sm text-text-3 hover:text-text"
              aria-expanded={all}
            >
              {all ? "Show less" : `Show ${items.length - HOT_LIMIT} more`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

const GOALS_LIMIT = 4;

/** Active goals with progress, soonest deadline first. */
function GoalsCard({ goals, today }: { goals: GoalSummary[]; today: string }) {
  return (
    <Card className="p-0 sm:p-0">
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <SectionTitle section={SECTIONS.goals}>Goals</SectionTitle>
        <Link href="/goals" className="text-sm text-accent hover:underline">
          {goals.length > GOALS_LIMIT ? `All ${goals.length} goals` : "All goals"}
        </Link>
      </div>
      {goals.length === 0 ? (
        <p className="px-4 pt-2 pb-5 text-center text-sm text-text-3">
          No active goals.{" "}
          <Link href="/goals" className="font-medium text-accent hover:underline">
            Set one
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-border px-1 pb-1">
          {goals.slice(0, GOALS_LIMIT).map((g) => {
            const pct = Math.round(g.progress * 100);
            const days = g.targetDate ? diffDays(g.targetDate, today) : null;
            return (
              <li key={g.id}>
                <Link href="/goals" className="block px-3 py-3 transition-colors hover:bg-surface-2 active:bg-surface-2">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[15px] font-medium sm:text-sm">{g.title}</span>
                    <span className="tabular shrink-0 text-xs font-semibold">{pct}%</span>
                  </span>
                  <span
                    className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-2"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${g.title} progress`}
                  >
                    <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: g.color }} />
                  </span>
                  <span className="mt-1.5 flex items-center justify-between gap-2 text-xs text-text-3">
                    <span className="truncate">{g.area}</span>
                    {days !== null && (
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1",
                          days < 0 ? "text-bad" : days <= 14 ? "text-warn" : undefined,
                        )}
                      >
                        <CalendarClock className="size-3" aria-hidden />
                        {days < 0 ? `${-days}d overdue` : days === 0 ? "Due today" : `${days}d left`}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
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
                sel ? "bg-brand border-transparent shadow-lg shadow-accent/30" : "border-border bg-surface text-text shadow-card hover:border-accent/40 active:bg-surface-2",
              )}
            >
              <span className={cn("text-[11px] font-medium", sel ? "text-white/80" : "text-text-3")}>
                {WEEKDAY_SHORT[dayOfWeek(d)].slice(0, 2)}
              </span>
              <span className="tabular text-base leading-none font-semibold">{Number(d.slice(8))}</span>
              <span
                className={cn("size-1 rounded-full", d === today ? (sel ? "bg-white" : "bg-accent") : "bg-transparent")}
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
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgb(255 255 255 / 0.25)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="#fff"
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

function SectionChip({ section }: { section: Section }) {
  const I = section.icon;
  return (
    <span className="chip-soft flex size-7 shrink-0 items-center justify-center rounded-lg" style={chipColor(section.color)}>
      <I className="size-4" aria-hidden />
    </span>
  );
}

function SectionTitle({ id, section, children }: { id?: string; section: Section; children: React.ReactNode }) {
  return (
    <h2 id={id} className="flex items-center gap-2 font-semibold">
      <SectionChip section={section} />
      {children}
    </h2>
  );
}
