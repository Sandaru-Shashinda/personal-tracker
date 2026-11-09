import "server-only";
import { and, asc, desc, eq, gte, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { addDays, startOfWeek, todayInTz } from "./dates";
import { categories, db, habitLogs, habits, journalEntries, tasks, type User } from "./db";

export function getCategories(userId: string) {
  return db.select().from(categories).where(eq(categories.userId, userId)).orderBy(asc(categories.name));
}

export function getHabits(userId: string, { includeArchived = false } = {}) {
  return db
    .select()
    .from(habits)
    .where(includeArchived ? eq(habits.userId, userId) : and(eq(habits.userId, userId), eq(habits.archived, false)))
    .orderBy(asc(habits.sortOrder), asc(habits.createdAt));
}

export function getLogs(userId: string, from: string, to: string) {
  return db
    .select({ habitId: habitLogs.habitId, date: habitLogs.date, value: habitLogs.value, note: habitLogs.note })
    .from(habitLogs)
    .where(and(eq(habitLogs.userId, userId), gte(habitLogs.date, from), lte(habitLogs.date, to)));
}

export function getAllLogs(userId: string) {
  return db
    .select({ habitId: habitLogs.habitId, date: habitLogs.date, value: habitLogs.value, note: habitLogs.note })
    .from(habitLogs)
    .where(eq(habitLogs.userId, userId));
}

export function getTasks(userId: string) {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .orderBy(
      asc(sql`${tasks.completedAt} IS NOT NULL`),
      desc(tasks.priority),
      sql`${tasks.dueDate} asc nulls last`,
      asc(tasks.createdAt),
    );
}

export function getJournal(userId: string, from: string, to: string) {
  return db
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.userId, userId), gte(journalEntries.date, from), lte(journalEntries.date, to)))
    .orderBy(desc(journalEntries.date));
}

export function journalEntryQuery(userId: string, date: string) {
  return db
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.userId, userId), eq(journalEntries.date, date)))
    .limit(1);
}

export async function getJournalEntry(userId: string, date: string) {
  const [row] = await journalEntryQuery(userId, date);
  return row ?? null;
}

/** Task counters for the dashboard, computed in the user's timezone. Run both queries in one `db.batch`. */
export function taskStatsQueries(user: Pick<User, "id" | "timezone" | "weekStartsOn">) {
  const today = todayInTz(user.timezone);
  const weekStart = startOfWeek(today, user.weekStartsOn);
  const lastWeekStart = addDays(weekStart, -7);
  const tz = user.timezone;
  const localDay = sql<string>`to_char(${tasks.completedAt} AT TIME ZONE ${tz}, 'YYYY-MM-DD')`;

  const counts = db
    .select({
      open: sql<number>`count(*) filter (where ${tasks.completedAt} is null)`.mapWith(Number),
      overdue: sql<number>`count(*) filter (where ${tasks.completedAt} is null and ${tasks.dueDate} < ${today})`.mapWith(
        Number,
      ),
      dueToday: sql<number>`count(*) filter (where ${tasks.completedAt} is null and ${tasks.dueDate} = ${today})`.mapWith(
        Number,
      ),
      doneToday: sql<number>`count(*) filter (where ${localDay} = ${today})`.mapWith(Number),
      doneThisWeek: sql<number>`count(*) filter (where ${localDay} >= ${weekStart})`.mapWith(Number),
      doneLastWeek: sql<number>`count(*) filter (where ${localDay} >= ${lastWeekStart} and ${localDay} < ${weekStart})`.mapWith(
        Number,
      ),
    })
    .from(tasks)
    .where(eq(tasks.userId, user.id));

  const completedByDay = db
    .select({ date: localDay, n: sql<number>`count(*)`.mapWith(Number) })
    .from(tasks)
    .where(and(eq(tasks.userId, user.id), isNotNull(tasks.completedAt), gte(tasks.completedAt, sql`now() - interval '400 days'`)))
    // Group by the first selected column. Repeating `localDay` would bind the timezone as a new
    // parameter ($3 vs $1), and Postgres won't treat those as the same expression.
    .groupBy(sql`1`);

  return [counts, completedByDay] as const;
}

export function taskStatsFrom(
  counts: Awaited<ReturnType<typeof taskStatsQueries>[0]>,
  completedByDay: Awaited<ReturnType<typeof taskStatsQueries>[1]>,
) {
  return { ...counts[0], completedByDay };
}

export function topLevelTasksQuery(userId: string) {
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), isNull(tasks.parentId)))
    .orderBy(desc(tasks.priority), asc(tasks.dueDate), asc(tasks.createdAt));
}

/** Open tasks due today or earlier, plus tasks completed today (so they stay visible once ticked). */
export function todayTasksFrom(rows: Awaited<ReturnType<typeof topLevelTasksQuery>>, today: string) {
  return rows.filter(
    (t) =>
      (!t.completedAt && t.dueDate && t.dueDate <= today) ||
      (t.completedAt && t.dueDate && t.dueDate <= today && Date.now() - t.completedAt.getTime() < 86_400_000),
  );
}
