import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, reminders } from "@/lib/db";
import { addDays, todayInTz } from "@/lib/dates";
import { getCategories, getHabits, getJournalEntry, getLogs, getTodayTasks } from "@/lib/queries";
import { indexLogs } from "@/lib/stats";
import { buildHabitDayViews } from "@/lib/view";
import { TodayView } from "./today-view";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage({ searchParams }: PageProps<"/today">) {
  const user = await requireUser();
  const today = todayInTz(user.timezone);
  const sp = await searchParams;
  const raw = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const date = raw > today ? today : raw;

  const [habits, logs, categories, tasks, entry, reminderRows] = await Promise.all([
    getHabits(user.id),
    getLogs(user.id, addDays(today, -400), today),
    getCategories(user.id),
    getTodayTasks(user.id, date),
    getJournalEntry(user.id, date),
    db.select().from(reminders).where(eq(reminders.userId, user.id)).orderBy(asc(reminders.time)),
  ]);

  const views = buildHabitDayViews(habits, indexLogs(logs), date, today, user.weekStartsOn);
  const notes = Object.fromEntries(logs.filter((l) => l.date === date && l.note).map((l) => [l.habitId, l.note!]));

  return (
    <TodayView
      key={date}
      date={date}
      today={today}
      name={user.name}
      views={views}
      notes={notes}
      categories={categories}
      tasks={tasks}
      reminders={reminderRows}
      entry={entry ? { mood: entry.mood, energy: entry.energy, content: entry.content } : null}
    />
  );
}
