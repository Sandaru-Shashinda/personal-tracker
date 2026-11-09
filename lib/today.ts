import { diffDays } from "./dates";
import type { Reminder, Task } from "./db/schema";
import { formatMoney } from "./expenses";
import { formatTime, milestoneLabel, occurrencesBetween } from "./reminder-schedule";
import type { HabitDayView } from "./view";

export type HotKind = "overdue" | "reminder" | "streak" | "goal" | "priority" | "budget";

/** One thing that needs attention right now, ready to render. */
export type HotItem = {
  key: string;
  kind: HotKind;
  title: string;
  detail: string;
  href: string;
  tone: "bad" | "warn" | "accent";
};

/** An active goal reduced to what the Today page shows. */
export type GoalSummary = {
  id: string;
  title: string;
  area: string;
  color: string;
  progress: number;
  targetDate: string | null;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Habit streaks of at least this many days count as "on the line" when today's check-in is missing. */
const STREAK_AT_RISK = 3;
/** Goals whose deadline is this close (or past) are flagged. */
const GOAL_SOON_DAYS = 14;
/** Budgets this far used (0–1) are flagged. */
const BUDGET_WARN = 0.9;

export function buildHotList({
  today,
  openTasks,
  reminders,
  habits,
  goals,
  budgets,
  currency,
}: {
  today: string;
  /** Open, top-level tasks. */
  openTasks: Task[];
  reminders: Reminder[];
  /** Habit views for today. */
  habits: HabitDayView[];
  goals: GoalSummary[];
  /** Monthly budget usage; category "" is the overall budget. */
  budgets: { category: string; spent: number; budget: number }[];
  currency: string;
}): HotItem[] {
  const out: HotItem[] = [];

  // Overdue tasks: one summary row; the Tasks card below lists them individually.
  const overdue = openTasks.filter((t) => t.dueDate && t.dueDate < today).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  if (overdue.length) {
    const oldest = overdue[0];
    const late = diffDays(today, oldest.dueDate!);
    out.push({
      key: "overdue",
      kind: "overdue",
      title: `${plural(overdue.length, "overdue task")}`,
      detail: overdue.length === 1 ? `${oldest.title} · ${plural(late, "day")} late` : `Oldest: ${oldest.title} · ${plural(late, "day")} late`,
      href: "/tasks",
      tone: "bad",
    });
  }

  // Reminders happening today.
  const todays = reminders
    .filter((r) => occurrencesBetween(r, today, today).length > 0)
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  for (const r of todays) {
    const milestone = milestoneLabel(r, today);
    out.push({
      key: `reminder-${r.id}`,
      kind: "reminder",
      title: r.title,
      detail: [r.time ? formatTime(r.time) : "All day", milestone, r.location].filter(Boolean).join(" · "),
      href: `/reminders?date=${today}`,
      tone: "accent",
    });
  }

  // Daily streaks that break if today's check-in is skipped.
  for (const v of habits) {
    if (!v.scheduled || v.done || v.streak.unit !== "days" || v.streak.current < STREAK_AT_RISK) continue;
    out.push({
      key: `streak-${v.habit.id}`,
      kind: "streak",
      title: v.habit.title,
      detail: `${v.streak.current}-day streak on the line`,
      href: `/habits/${v.habit.id}`,
      tone: "warn",
    });
  }

  // Goals with a deadline that's close or already gone.
  for (const g of goals) {
    if (!g.targetDate || g.progress >= 1) continue;
    const days = diffDays(g.targetDate, today);
    if (days > GOAL_SOON_DAYS) continue;
    const pct = `${Math.round(g.progress * 100)}% done`;
    out.push({
      key: `goal-${g.id}`,
      kind: "goal",
      title: g.title,
      detail:
        days < 0 ? `${plural(-days, "day")} past deadline · ${pct}` : days === 0 ? `Due today · ${pct}` : `${plural(days, "day")} left · ${pct}`,
      href: "/goals",
      tone: days < 0 ? "bad" : "warn",
    });
  }

  // High-priority tasks that aren't due yet (anything due by today is already in the Tasks card).
  const urgent = openTasks
    .filter((t) => t.priority === 3 && (!t.dueDate || t.dueDate > today))
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .slice(0, 3);
  for (const t of urgent) {
    const days = t.dueDate ? diffDays(t.dueDate, today) : null;
    out.push({
      key: `priority-${t.id}`,
      kind: "priority",
      title: t.title,
      detail: `High priority · ${days === null ? "no due date" : days === 1 ? "due tomorrow" : `due in ${days} days`}`,
      href: "/tasks",
      tone: "warn",
    });
  }

  // Budgets nearly or fully spent this month.
  for (const b of budgets) {
    if (b.budget <= 0 || b.spent < b.budget * BUDGET_WARN) continue;
    const over = b.spent > b.budget;
    out.push({
      key: `budget-${b.category || "overall"}`,
      kind: "budget",
      title: `${b.category || "Monthly"} budget ${Math.round((b.spent / b.budget) * 100)}% used`,
      detail: over
        ? `${formatMoney(b.spent - b.budget, currency)} over this month`
        : `${formatMoney(b.budget - b.spent, currency)} left this month`,
      href: "/expenses",
      tone: over ? "bad" : "warn",
    });
  }

  return out;
}
