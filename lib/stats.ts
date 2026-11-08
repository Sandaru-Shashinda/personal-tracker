import {
  addDays,
  dayOfWeek,
  dayRange,
  maxDay,
  startOfWeek,
  WEEKDAY_LONG,
} from "./dates";

export type HabitLike = {
  id: string;
  title: string;
  color: string;
  categoryId: string | null;
  type: "check" | "count";
  target: number;
  frequency: "daily" | "days" | "weekly";
  daysOfWeek: number[];
  timesPerWeek: number;
  startDate: string;
  archived: boolean;
};

export type LogLike = { habitId: string; date: string; value: number };

/** logs indexed as habitId -> date -> value */
export type LogIndex = Map<string, Map<string, number>>;

export function indexLogs(logs: LogLike[]): LogIndex {
  const idx: LogIndex = new Map();
  for (const l of logs) {
    let m = idx.get(l.habitId);
    if (!m) idx.set(l.habitId, (m = new Map()));
    m.set(l.date, l.value);
  }
  return idx;
}

export function isDone(habit: HabitLike, value: number | undefined): boolean {
  return value !== undefined && value >= habit.target;
}

/** Whether the habit is "due" on a specific day (weekly habits are due every day until the quota is hit). */
export function isScheduled(habit: HabitLike, day: string): boolean {
  if (day < habit.startDate) return false;
  if (habit.frequency === "days") return habit.daysOfWeek.includes(dayOfWeek(day));
  return true;
}

function weeklyDoneCount(habit: HabitLike, logs: Map<string, number> | undefined, weekStart: string, upTo: string) {
  if (!logs) return 0;
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    if (d > upTo) break;
    if (isDone(habit, logs.get(d))) n++;
  }
  return n;
}

export type StreakInfo = { current: number; best: number; unit: "days" | "weeks" };

export function computeStreak(
  habit: HabitLike,
  logs: Map<string, number> | undefined,
  today: string,
  weekStartsOn = 1,
): StreakInfo {
  if (habit.frequency === "weekly") {
    // Streak counted in consecutive weeks that hit the quota. The current week counts once it's met,
    // and doesn't break the streak while still in progress.
    const firstWeek = startOfWeek(habit.startDate, weekStartsOn);
    const thisWeek = startOfWeek(today, weekStartsOn);
    const weeks: boolean[] = [];
    for (let w = firstWeek; w <= thisWeek; w = addDays(w, 7)) {
      weeks.push(weeklyDoneCount(habit, logs, w, today) >= habit.timesPerWeek);
    }
    let best = 0;
    let run = 0;
    for (const ok of weeks) {
      run = ok ? run + 1 : 0;
      best = Math.max(best, run);
    }
    let current = 0;
    let i = weeks.length - 1;
    if (i >= 0 && !weeks[i]) i--; // in-progress week doesn't break it
    for (; i >= 0 && weeks[i]; i--) current++;
    return { current, best, unit: "weeks" };
  }

  // Daily / specific-days: consecutive scheduled days completed.
  const days = dayRange(habit.startDate, today);
  let best = 0;
  let run = 0;
  for (const d of days) {
    if (!isScheduled(habit, d)) continue;
    if (isDone(habit, logs?.get(d))) {
      run++;
      best = Math.max(best, run);
    } else if (d !== today) {
      run = 0;
    }
  }
  // current: walk backwards; today unfinished doesn't break it.
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    if (!isScheduled(habit, d)) continue;
    if (isDone(habit, logs?.get(d))) current++;
    else if (d === today) continue;
    else break;
  }
  return { current, best, unit: "days" };
}

/**
 * Expected vs completed occurrences for a habit over [from, to].
 * Weekly habits contribute `timesPerWeek` per (partial) week, capped by completions.
 */
export function habitCompletion(
  habit: HabitLike,
  logs: Map<string, number> | undefined,
  from: string,
  to: string,
  weekStartsOn = 1,
  /** A day still in progress (today): it only counts once it's done. */
  pendingDay?: string,
): { expected: number; done: number } {
  const start = maxDay(from, habit.startDate);
  if (start > to) return { expected: 0, done: 0 };
  if (habit.frequency === "weekly") {
    let expected = 0;
    let done = 0;
    for (let w = startOfWeek(start, weekStartsOn); w <= to; w = addDays(w, 7)) {
      const weekEnd = addDays(w, 6) < to ? addDays(w, 6) : to;
      const span = dayRange(maxDay(w, start), weekEnd);
      const quota = Math.min(habit.timesPerWeek, Math.ceil((habit.timesPerWeek * span.length) / 7));
      let n = 0;
      for (const d of span) {
        if (isDone(habit, logs?.get(d))) n++;
      }
      expected += quota;
      done += Math.min(n, quota);
    }
    return { expected, done };
  }
  let expected = 0;
  let done = 0;
  for (const d of dayRange(start, to)) {
    if (!isScheduled(habit, d)) continue;
    const ok = isDone(habit, logs?.get(d));
    if (d === pendingDay && !ok) continue;
    expected++;
    if (ok) done++;
  }
  return { expected, done };
}

/** Per-day completion ratio (0..1) across all daily-scheduled habits, or null when nothing was due. */
export function dailyScores(
  habits: HabitLike[],
  idx: LogIndex,
  from: string,
  to: string,
): { date: string; ratio: number | null; done: number; due: number }[] {
  return dayRange(from, to).map((date) => {
    let due = 0;
    let done = 0;
    for (const h of habits) {
      if (!isScheduled(h, date)) continue;
      const ok = isDone(h, idx.get(h.id)?.get(date));
      if (h.frequency === "weekly") {
        // weekly habits only count on days they were actually done (bonus, never a penalty)
        if (ok) {
          due++;
          done++;
        }
        continue;
      }
      due++;
      if (ok) done++;
    }
    return { date, due, done, ratio: due ? done / due : null };
  });
}

export type Insight = { title: string; detail: string; tone: "good" | "bad" | "neutral"; icon: string };

export function buildInsights(params: {
  habits: HabitLike[];
  idx: LogIndex;
  today: string;
  moods: { date: string; mood: number | null }[];
  tasksDoneThisWeek: number;
  tasksDoneLastWeek: number;
  overdueTasks: number;
  weekStartsOn: number;
}): Insight[] {
  const { habits, idx, today, moods, weekStartsOn } = params;
  const insights: Insight[] = [];
  const from = addDays(today, -89);
  const scores = dailyScores(habits, idx, from, addDays(today, -1)).filter((s) => s.ratio !== null);

  // Best / worst weekday
  if (scores.length >= 14) {
    const byDow = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }));
    for (const s of scores) {
      const b = byDow[dayOfWeek(s.date)];
      b.sum += s.ratio!;
      b.n++;
    }
    const avgs = byDow.map((b, i) => ({ dow: i, avg: b.n ? b.sum / b.n : -1 })).filter((a) => a.avg >= 0);
    avgs.sort((a, b) => b.avg - a.avg);
    const best = avgs[0];
    const worst = avgs[avgs.length - 1];
    if (best && worst && best.avg - worst.avg > 0.05) {
      insights.push({
        icon: "trophy",
        tone: "good",
        title: `${WEEKDAY_LONG[best.dow]}s are your strongest day`,
        detail: `You complete ${Math.round(best.avg * 100)}% of habits on ${WEEKDAY_LONG[best.dow]}s vs ${Math.round(
          worst.avg * 100,
        )}% on ${WEEKDAY_LONG[worst.dow]}s.`,
      });
    }
  }

  // Most consistent / most skipped habit (last 30 days)
  const last30 = addDays(today, -29);
  const rates = habits
    .filter((h) => !h.archived)
    .map((h) => {
      const c = habitCompletion(h, idx.get(h.id), last30, addDays(today, -1), weekStartsOn);
      return { h, rate: c.expected ? c.done / c.expected : null, expected: c.expected };
    })
    .filter((r) => r.rate !== null && r.expected >= 4) as { h: HabitLike; rate: number; expected: number }[];
  if (rates.length) {
    rates.sort((a, b) => b.rate - a.rate);
    const top = rates[0];
    if (top.rate >= 0.6)
      insights.push({
        icon: "flame",
        tone: "good",
        title: `"${top.h.title}" is your most consistent habit`,
        detail: `${Math.round(top.rate * 100)}% completion over the last 30 days.`,
      });
    const low = rates[rates.length - 1];
    if (rates.length > 1 && low.rate < 0.6)
      insights.push({
        icon: "alert",
        tone: "bad",
        title: `"${low.h.title}" gets skipped the most`,
        detail: `Only ${Math.round(low.rate * 100)}% done in the last 30 days. Try a smaller target or a reminder.`,
      });
  }

  // Trend: last 14 days vs previous 14
  const recent = dailyScores(habits, idx, addDays(today, -14), addDays(today, -1)).filter((s) => s.ratio !== null);
  const prior = dailyScores(habits, idx, addDays(today, -28), addDays(today, -15)).filter((s) => s.ratio !== null);
  if (recent.length >= 5 && prior.length >= 5) {
    const avg = (a: typeof recent) => a.reduce((s, x) => s + x.ratio!, 0) / a.length;
    const delta = avg(recent) - avg(prior);
    if (Math.abs(delta) >= 0.05)
      insights.push({
        icon: delta > 0 ? "trending-up" : "trending-down",
        tone: delta > 0 ? "good" : "bad",
        title: delta > 0 ? "You're trending up" : "You've slipped a bit lately",
        detail: `Habit completion is ${delta > 0 ? "up" : "down"} ${Math.round(Math.abs(delta) * 100)} points over the last two weeks.`,
      });
  }

  // Mood vs habits
  const scoreByDate = new Map(scores.map((s) => [s.date, s.ratio!]));
  const paired = moods.filter((m) => m.mood != null && scoreByDate.has(m.date));
  if (paired.length >= 7) {
    const good = paired.filter((m) => m.mood! >= 4);
    const bad = paired.filter((m) => m.mood! <= 2);
    if (good.length >= 2 && bad.length >= 2) {
      const g = good.reduce((s, m) => s + scoreByDate.get(m.date)!, 0) / good.length;
      const b = bad.reduce((s, m) => s + scoreByDate.get(m.date)!, 0) / bad.length;
      if (Math.abs(g - b) >= 0.1)
        insights.push({
          icon: "smile",
          tone: "neutral",
          title: g > b ? "Good days and good habits go together" : "Habits don't seem to lift your mood yet",
          detail: `On good-mood days you complete ${Math.round(g * 100)}% of habits, vs ${Math.round(b * 100)}% on low days.`,
        });
    }
  }

  // Tasks
  if (params.tasksDoneThisWeek || params.tasksDoneLastWeek) {
    const d = params.tasksDoneThisWeek - params.tasksDoneLastWeek;
    insights.push({
      icon: "list-checks",
      tone: d >= 0 ? "good" : "neutral",
      title: `${params.tasksDoneThisWeek} tasks done this week`,
      detail:
        d === 0
          ? "Same pace as last week."
          : `${Math.abs(d)} ${d > 0 ? "more" : "fewer"} than last week (${params.tasksDoneLastWeek}).`,
    });
  }
  if (params.overdueTasks > 0)
    insights.push({
      icon: "clock",
      tone: "bad",
      title: `${params.overdueTasks} overdue task${params.overdueTasks === 1 ? "" : "s"}`,
      detail: "Reschedule or knock them out to keep the list honest.",
    });

  if (!insights.length)
    insights.push({
      icon: "sparkles",
      tone: "neutral",
      title: "Insights unlock as you go",
      detail: "Track habits for a couple of weeks and patterns will show up here.",
    });
  return insights;
}
