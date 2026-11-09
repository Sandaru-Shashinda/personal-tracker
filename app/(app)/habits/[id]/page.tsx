import { and, eq } from "drizzle-orm";
import { ArrowLeft, Flame } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { addDays, dayOfWeek, dayRange, prettyDay, todayInTz, WEEKDAY_SHORT } from "@/lib/dates";
import { categories, db, habitLogs, habits } from "@/lib/db";
import { frequencyLabel } from "@/lib/format";
import { computeStreak, habitCompletion, isDone, isScheduled } from "@/lib/stats";
import { HabitCalendar } from "./habit-calendar";
import { HabitActions } from "./habit-actions";
import { ValueChart, WeekdayChart } from "./habit-charts";

export default async function HabitDetail({ params }: PageProps<"/habits/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  // One round trip; logs are scoped to the user too, so nothing leaks if the habit isn't theirs.
  const [[habit], logs, cats] = await db.batch([
    db
      .select()
      .from(habits)
      .where(and(eq(habits.id, id), eq(habits.userId, user.id)))
      .limit(1),
    db
      .select()
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, id), eq(habitLogs.userId, user.id))),
    db.select().from(categories).where(eq(categories.userId, user.id)),
  ]);
  if (!habit) notFound();
  const today = todayInTz(user.timezone);
  const ws = user.weekStartsOn;
  const map = new Map(logs.map((l) => [l.date, l.value]));
  const streak = computeStreak(habit, map, today, ws);
  const r30 = habitCompletion(habit, map, addDays(today, -29), today, ws, today);
  const rAll = habitCompletion(habit, map, habit.startDate, today, ws, today);
  const doneLogs = logs.filter((l) => isDone(habit, l.value));
  const totalValue = logs.reduce((s, l) => s + l.value, 0);

  const byDow = Array.from({ length: 7 }, (_, i) => ({ dow: (ws + i) % 7, done: 0, due: 0 }));
  for (const d of dayRange(habit.startDate > addDays(today, -179) ? habit.startDate : addDays(today, -179), today)) {
    const b = byDow.find((x) => x.dow === dayOfWeek(d))!;
    if (isScheduled(habit, d)) b.due++;
    if (isDone(habit, map.get(d))) b.done++;
  }
  const weekdayData = byDow.map((b) => ({
    label: WEEKDAY_SHORT[b.dow],
    value: b.due ? Math.round((b.done / b.due) * 100) : 0,
    done: b.done,
  }));

  const valueSeries = dayRange(addDays(today, -29), today).map((d) => ({ label: d.slice(5), date: d, value: map.get(d) ?? 0 }));
  const notes = logs
    .filter((l) => l.note)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20);
  const pct = (c: { expected: number; done: number }) => (c.expected ? `${Math.round((c.done / c.expected) * 100)}%` : "–");
  const category = cats.find((c) => c.id === habit.categoryId);

  return (
    <div className="space-y-6">
      <Link href="/habits" className="inline-flex items-center gap-1 text-sm text-text-3 hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Habits
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-2xl text-white" style={{ background: habit.color }}>
            <Icon name={habit.icon} className="size-7" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{habit.title}</h1>
            <p className="text-sm text-text-3">
              {frequencyLabel(habit)}
              {habit.type === "count" && ` · target ${habit.target} ${habit.unit ?? ""}`}
              {category && ` · ${category.name}`} · since {prettyDay(habit.startDate, { weekday: undefined, year: "numeric" })}
            </p>
            {habit.description && <p className="mt-1 max-w-xl text-sm text-text-2">{habit.description}</p>}
          </div>
        </div>
        <HabitActions habit={habit} categories={cats} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Current streak" value={String(streak.current)} unit={streak.unit} icon={streak.current > 0} />
        <Stat label="Best streak" value={String(streak.best)} unit={streak.unit} />
        <Stat label="Last 30 days" value={pct(r30)} />
        <Stat label="All time" value={pct(rAll)} />
        <Stat label="Times completed" value={String(doneLogs.length)} />
        <Stat
          label={habit.type === "count" ? `Total ${habit.unit ?? ""}`.trim() : "Days logged"}
          value={habit.type === "count" ? String(Math.round(totalValue * 10) / 10) : String(logs.length)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <HabitCalendar habit={habit} logs={Object.fromEntries(map)} today={today} weekStartsOn={ws} />
        <div className="space-y-6">
          {habit.type === "count" ? (
            <ValueChart data={valueSeries} target={habit.target} unit={habit.unit ?? ""} color={habit.color} />
          ) : null}
          <WeekdayChart data={weekdayData} />
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-surface shadow-card p-4 sm:p-5">
        <h2 className="mb-3 text-base font-semibold">Notes</h2>
        {notes.length === 0 ? (
          <p className="text-sm text-text-3">Add notes to check-ins from the Today page and they&apos;ll appear here.</p>
        ) : (
          <ul className="divide-y divide-border">
            {notes.map((n) => (
              <li key={n.id} className="flex gap-4 py-2.5 text-sm">
                <span className="w-28 shrink-0 text-text-3">{prettyDay(n.date)}</span>
                <span className="text-text-2">{n.note}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, unit, icon }: { label: string; value: string; unit?: string; icon?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-surface shadow-card p-4">
      <p className="text-xs text-text-3">{label}</p>
      <p className="tabular mt-1 flex items-center gap-1 text-2xl font-semibold">
        {icon && <Flame className="size-5 text-warn" aria-hidden />}
        {value}
        {unit && <span className="text-sm font-normal text-text-3">{unit}</span>}
      </p>
    </div>
  );
}
