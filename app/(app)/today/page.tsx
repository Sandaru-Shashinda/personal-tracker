import type { Metadata } from "next";
import { and, asc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { budgets, db, expenses, goalMilestones, goals, reminders, tasks } from "@/lib/db";
import { addDays, startOfMonth, todayInTz } from "@/lib/dates";
import { progressOf } from "@/lib/goals";
import { getCategories, getHabits, getJournalEntry, getLogs, getTodayTasks } from "@/lib/queries";
import { indexLogs } from "@/lib/stats";
import { buildHotList, type GoalSummary } from "@/lib/today";
import { buildHabitDayViews } from "@/lib/view";
import { TodayView } from "./today-view";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage({ searchParams }: PageProps<"/today">) {
  const user = await requireUser();
  const today = todayInTz(user.timezone);
  const sp = await searchParams;
  const raw = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const date = raw > today ? today : raw;
  const monthStart = startOfMonth(today);
  const nextMonth = startOfMonth(addDays(monthStart, 32));

  const [habits, logs, categories, dayTasks, entry, reminderRows, openTasks, goalRows, milestones, budgetRows, spentRows] =
    await Promise.all([
      getHabits(user.id),
      getLogs(user.id, addDays(today, -400), today),
      getCategories(user.id),
      getTodayTasks(user.id, date),
      getJournalEntry(user.id, date),
      db.select().from(reminders).where(eq(reminders.userId, user.id)).orderBy(asc(reminders.time)),
      db
        .select()
        .from(tasks)
        .where(and(eq(tasks.userId, user.id), isNull(tasks.completedAt), isNull(tasks.parentId))),
      db
        .select()
        .from(goals)
        .where(and(eq(goals.userId, user.id), eq(goals.status, "active"))),
      db
        .select({ goalId: goalMilestones.goalId, done: goalMilestones.done })
        .from(goalMilestones)
        .where(eq(goalMilestones.userId, user.id)),
      db.select().from(budgets).where(eq(budgets.userId, user.id)),
      db
        .select({ category: expenses.category, spent: sql<number>`sum(${expenses.amount})`.mapWith(Number) })
        .from(expenses)
        .where(
          and(
            eq(expenses.userId, user.id),
            eq(expenses.kind, "expense"),
            gte(expenses.date, monthStart),
            lt(expenses.date, nextMonth),
          ),
        )
        .groupBy(expenses.category),
    ]);

  const idx = indexLogs(logs);
  const views = buildHabitDayViews(habits, idx, date, today, user.weekStartsOn);
  const notes = Object.fromEntries(logs.filter((l) => l.date === date && l.note).map((l) => [l.habitId, l.note!]));

  // Active goals, soonest deadline first (undated last), then newest.
  const goalSummaries: GoalSummary[] = goalRows
    .sort(
      (a, b) =>
        (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999") || b.createdAt.getTime() - a.createdAt.getTime(),
    )
    .map((g) => ({
      id: g.id,
      title: g.title,
      area: g.area,
      color: g.color,
      targetDate: g.targetDate,
      progress: progressOf(
        g,
        milestones.filter((m) => m.goalId === g.id),
      ),
    }));

  // "Hot right now" is about the present, so it's only built when looking at today.
  let hot: ReturnType<typeof buildHotList> = [];
  if (date === today) {
    const spent = new Map(spentRows.map((r) => [r.category, r.spent]));
    const total = spentRows.reduce((s, r) => s + r.spent, 0);
    hot = buildHotList({
      today,
      openTasks,
      reminders: reminderRows,
      habits: views,
      goals: goalSummaries,
      budgets: budgetRows.map((b) => ({
        category: b.category,
        budget: b.amount,
        spent: b.category === "" ? total : (spent.get(b.category) ?? 0),
      })),
      currency: user.currency,
    });
  }

  return (
    <TodayView
      key={date}
      date={date}
      today={today}
      name={user.name}
      views={views}
      notes={notes}
      categories={categories}
      tasks={dayTasks}
      reminders={reminderRows}
      goals={goalSummaries}
      hot={hot}
      entry={entry ? { mood: entry.mood, energy: entry.energy, content: entry.content } : null}
    />
  );
}
