import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, Flame, Lightbulb, ListTodo, Smile, TrendingUp, type LucideIcon } from "lucide-react";
import { Icon } from "@/components/icons";
import { moodEmojiServer } from "@/components/mood-server";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays, dayRange, startOfMonth, startOfWeek, todayInTz } from "@/lib/dates";
import { getCategories, getHabits, getJournal, getLogs, taskStatsFrom, taskStatsQueries } from "@/lib/queries";
import { buildInsights, computeStreak, dailyScores, habitCompletion, indexLogs } from "@/lib/stats";
import { CategoryBars, MoodChart, TasksChart, TrendChart, type TrendPoint } from "./charts";
import { Heatmap } from "./heatmap";

export const metadata: Metadata = { title: "Dashboard" };

const pct = (n: number | null) => (n === null ? "–" : `${Math.round(n * 100)}%`);

export default async function DashboardPage() {
  const user = await requireUser();
  const today = todayInTz(user.timezone);
  const yearAgo = addDays(today, -370);
  // One HTTP request for all queries (Neon is far away; each round trip is expensive).
  const [habits, logs, categories, taskCounts, completedByDay, journal] = await db.batch([
    getHabits(user.id),
    getLogs(user.id, addDays(today, -800), today),
    getCategories(user.id),
    ...taskStatsQueries(user),
    getJournal(user.id, addDays(today, -400), today),
  ]);
  const taskStats = taskStatsFrom(taskCounts, completedByDay);
  const idx = indexLogs(logs);
  const ws = user.weekStartsOn;

  // --- tiles ---
  const scoresYear = dailyScores(habits, idx, yearAgo, today);
  const todayScore = scoresYear[scoresYear.length - 1];
  const rateOver = (from: string, to: string) => {
    let e = 0;
    let d = 0;
    for (const h of habits) {
      const c = habitCompletion(h, idx.get(h.id), from, to, ws, today);
      e += c.expected;
      d += c.done;
    }
    return e ? d / e : null;
  };
  const rate30 = rateOver(addDays(today, -29), today);
  const ratePrev30 = rateOver(addDays(today, -59), addDays(today, -30));
  const streaks = habits.map((h) => ({ h, s: computeStreak(h, idx.get(h.id), today, ws) }));
  const topStreak = streaks.reduce<(typeof streaks)[number] | null>(
    (best, x) => (!best || x.s.current > best.s.current ? x : best),
    null,
  );
  const moods7 = journal.filter((j) => j.date > addDays(today, -7) && j.mood != null);
  const avgMood7 = moods7.length ? moods7.reduce((s, j) => s + j.mood!, 0) / moods7.length : null;

  // --- trend series (daily 30d, weekly 12w, monthly 12m) ---
  // daily view uses per-day scores (weekly-quota habits only count on days they were done)
  const daily: TrendPoint[] = scoresYear.slice(-30).map((s) => ({
    key: s.date,
    label: s.date.slice(5),
    value: s.ratio === null ? null : Math.round(s.ratio * 100),
  }));
  const weekly: TrendPoint[] = Array.from({ length: 12 }, (_, i) => {
    const w = addDays(startOfWeek(today, ws), -7 * (11 - i));
    const end = addDays(w, 6) > today ? today : addDays(w, 6);
    const r = rateOver(w, end);
    return { key: w, label: w.slice(5), value: r === null ? null : Math.round(r * 100) };
  });
  const monthly: TrendPoint[] = Array.from({ length: 12 }, (_, i) => {
    const [y, m] = startOfMonth(today).split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1 - (11 - i), 1));
    const from = dt.toISOString().slice(0, 10);
    const next = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
    const to = addDays(next, -1) > today ? today : addDays(next, -1);
    const r = rateOver(from, to);
    return {
      key: from,
      label: dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      value: r === null ? null : Math.round(r * 100),
    };
  });

  // --- mood series ---
  const journalByDate = new Map(journal.map((j) => [j.date, j]));
  const moodSeries = dayRange(addDays(today, -29), today).map((d) => ({
    label: d.slice(5),
    date: d,
    mood: journalByDate.get(d)?.mood ?? null,
    energy: journalByDate.get(d)?.energy ?? null,
  }));

  // --- tasks per day ---
  const doneByDay = new Map(taskStats.completedByDay.map((r) => [r.date, r.n]));
  const tasksSeries = dayRange(addDays(today, -13), today).map((d) => ({
    label: d.slice(5),
    date: d,
    value: doneByDay.get(d) ?? 0,
  }));

  // --- by category ---
  const catRows = [...categories, { id: null as string | null, name: "Uncategorised", color: "#8a8984" }]
    .map((c) => {
      const hs = habits.filter((h) => h.categoryId === c.id);
      let e = 0;
      let d = 0;
      for (const h of hs) {
        const r = habitCompletion(h, idx.get(h.id), addDays(today, -29), today, ws, today);
        e += r.expected;
        d += r.done;
      }
      return { name: c.name, value: e ? Math.round((d / e) * 100) : null, habits: hs.length };
    })
    .filter((r) => r.habits > 0 && r.value !== null) as { name: string; value: number; habits: number }[];

  // --- heatmap ---
  const heatStart = startOfWeek(addDays(today, -364), ws);
  const heat = dailyScores(habits, idx, heatStart, today).map((s) => ({
    ...s,
    tasks: doneByDay.get(s.date) ?? 0,
    mood: journalByDate.get(s.date)?.mood ?? null,
  }));
  const activeDays = heat.filter((h) => h.done > 0).length;

  const insights = buildInsights({
    habits,
    idx,
    today,
    moods: journal.map((j) => ({ date: j.date, mood: j.mood })),
    tasksDoneThisWeek: taskStats.doneThisWeek,
    tasksDoneLastWeek: taskStats.doneLastWeek,
    overdueTasks: taskStats.overdue,
    weekStartsOn: ws,
  });

  const leaderboard = streaks
    .map(({ h, s }) => {
      const c = habitCompletion(h, idx.get(h.id), addDays(today, -29), today, ws, today);
      return { h, s, rate: c.expected ? c.done / c.expected : null };
    })
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));

  const delta = rate30 !== null && ratePrev30 !== null ? Math.round((rate30 - ratePrev30) * 100) : null;
  const taskDelta = taskStats.doneThisWeek - taskStats.doneLastWeek;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" sub="Your progress across habits, tasks and mood." />

      <div className="animate-rise grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile
          icon={CalendarCheck}
          color="#f59e0b"
          label="Today"
          value={todayScore?.due ? `${todayScore.done}/${todayScore.due}` : "–"}
          sub={todayScore?.due ? `${pct(todayScore.ratio)} of habits done` : "nothing due"}
        />
        <Tile
          icon={TrendingUp}
          color="#6366f1"
          label="30-day completion"
          value={pct(rate30)}
          sub={delta === null ? "habits completed vs due" : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)} pts vs prior 30 days`}
          tone={delta === null ? undefined : delta >= 0 ? "good" : "bad"}
        />
        <Tile
          icon={Flame}
          color="#f97316"
          label="Best active streak"
          value={topStreak && topStreak.s.current ? `${topStreak.s.current}` : "0"}
          unit={topStreak?.s.unit === "weeks" ? "weeks" : "days"}
          sub={topStreak && topStreak.s.current ? topStreak.h.title : "start one today"}
        />
        <Tile
          icon={ListTodo}
          color="#3b82f6"
          label="Tasks this week"
          value={String(taskStats.doneThisWeek)}
          sub={`${taskDelta >= 0 ? "▲" : "▼"} ${Math.abs(taskDelta)} vs last week · ${taskStats.open} open`}
          tone={taskDelta >= 0 ? "good" : undefined}
        />
        <Tile
          icon={Smile}
          color="#ec4899"
          label="Mood (7 days)"
          value={avgMood7 === null ? "–" : avgMood7.toFixed(1)}
          unit={avgMood7 === null ? undefined : "/ 5"}
          sub={avgMood7 === null ? "log mood on Today" : `${moodEmojiServer(Math.round(avgMood7))} from ${moods7.length} entries`}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <section className="rounded-2xl border border-border bg-surface shadow-card p-4 sm:p-5" aria-labelledby="heat-h">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 id="heat-h" className="text-base font-semibold">
              Consistency
            </h2>
            <p className="text-xs text-text-3">Share of due habits completed each day, past year</p>
          </div>
          <p className="text-sm text-text-2">
            <span className="tabular font-semibold text-text">{activeDays}</span> active days
          </p>
        </div>
        <Heatmap days={heat} weekStartsOn={ws} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrendChart daily={daily} weekly={weekly} monthly={monthly} />
        </div>
        <section className="rounded-2xl border border-border bg-surface shadow-card p-4 sm:p-5" aria-labelledby="ins-h">
          <h2 id="ins-h" className="mb-4 flex items-center gap-2 text-base font-semibold">
            <span className="chip-soft flex size-7 items-center justify-center rounded-lg" style={{ "--c": "#f59e0b" } as React.CSSProperties}>
              <Lightbulb className="size-4" aria-hidden />
            </span>
            Insights
          </h2>
          <ul className="space-y-3">
            {insights.map((i) => (
              <li key={i.title} className="flex gap-3">
                <span
                  className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${
                    i.tone === "good" ? "bg-good/10 text-good" : i.tone === "bad" ? "bg-bad/10 text-bad" : "bg-surface-2 text-text-2"
                  }`}
                >
                  <Icon name={i.icon} className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">{i.title}</p>
                  <p className="text-xs text-text-3">{i.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <MoodChart data={moodSeries} />
        <TasksChart data={tasksSeries} />
        <CategoryBars data={catRows} />
      </div>

      <section className="rounded-2xl border border-border bg-surface shadow-card" aria-labelledby="lb-h">
        <div className="flex items-baseline justify-between p-4 pb-2 sm:p-5 sm:pb-2">
          <h2 id="lb-h" className="text-base font-semibold">
            Habits
          </h2>
          <Link href="/habits" className="text-sm text-accent hover:underline">
            Manage
          </Link>
        </div>
        {leaderboard.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-text-3">No habits yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs text-text-3">
                  <th className="px-5 py-2 font-medium">Habit</th>
                  <th className="px-3 py-2 font-medium">Last 14 days</th>
                  <th className="px-3 py-2 text-right font-medium">Streak</th>
                  <th className="px-3 py-2 text-right font-medium">Best</th>
                  <th className="px-5 py-2 text-right font-medium">30-day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leaderboard.map(({ h, s, rate }) => (
                  <tr key={h.id}>
                    <td className="px-5 py-2.5">
                      <Link href={`/habits/${h.id}`} className="flex items-center gap-2 font-medium hover:underline">
                        <span
                          className="flex size-6 items-center justify-center rounded-md text-white"
                          style={{ background: h.color }}
                        >
                          <Icon name={h.icon} className="size-3.5" />
                        </span>
                        {h.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-[2px]">
                        {dayRange(addDays(today, -13), today).map((d) => {
                          const v = idx.get(h.id)?.get(d);
                          const done = v !== undefined && v >= h.target;
                          return (
                            <span
                              key={d}
                              title={`${d}: ${done ? "done" : "not done"}`}
                              className="h-4 w-2 rounded-[3px]"
                              style={{ background: done ? h.color : "var(--grid)" }}
                            />
                          );
                        })}
                      </div>
                    </td>
                    <td className="tabular px-3 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1">
                        {s.current > 0 && <Flame className="size-3.5 text-warn" aria-hidden />}
                        {s.current}
                        <span className="text-text-3">{s.unit === "weeks" ? "w" : "d"}</span>
                      </span>
                    </td>
                    <td className="tabular px-3 py-2.5 text-right text-text-2">
                      {s.best}
                      <span className="text-text-3">{s.unit === "weeks" ? "w" : "d"}</span>
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                          <div className="h-full rounded-full" style={{ width: `${(rate ?? 0) * 100}%`, background: h.color }} />
                        </div>
                        <span className="tabular w-9 text-right">{pct(rate)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Tile({
  icon: I,
  color,
  label,
  value,
  unit,
  sub,
  tone,
  className = "",
}: {
  icon: LucideIcon;
  color: string;
  label: string;
  value: string;
  unit?: string;
  sub: string;
  tone?: "good" | "bad";
  className?: string;
}) {
  return (
    <div
      className={`relative isolate overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-card ${className}`}
      style={{ "--c": color } as React.CSSProperties}
    >
      <div className="chip-soft absolute -top-8 -right-8 -z-10 size-24 rounded-full opacity-60 blur-xl" aria-hidden />
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-text-3">{label}</p>
        <span className="chip-soft flex size-7 shrink-0 items-center justify-center rounded-lg">
          <I className="size-4" aria-hidden />
        </span>
      </div>
      <p className="tabular mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-text-3">{unit}</span>}
      </p>
      <p className={`mt-1 truncate text-xs ${tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-text-3"}`}>
        {sub}
      </p>
    </div>
  );
}
