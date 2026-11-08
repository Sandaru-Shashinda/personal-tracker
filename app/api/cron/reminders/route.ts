import { and, eq, inArray, isNotNull, isNull, lte, or } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { timeInTz, todayInTz } from "@/lib/dates";
import { db, habitLogs, habits, reminders, tasks, users } from "@/lib/db";
import { pushConfigured, sendToUser } from "@/lib/push";
import { alertText, dueAlert } from "@/lib/reminder-schedule";
import { isDone, isScheduled, startOfWeekCount } from "@/lib/reminders";

// Call this every 5–15 minutes (Vercel Cron on Pro, or any external cron service on Hobby).
// Auth: `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this automatically) or `?secret=`.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.nextUrl.searchParams.get("secret");
  if (!secret || provided !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });

  const now = new Date();
  let habitReminders = 0;
  let taskReminders = 0;
  let eventReminders = 0;

  // ---- Habit reminders ----
  const candidates = await db
    .select({ habit: habits, timezone: users.timezone, weekStartsOn: users.weekStartsOn })
    .from(habits)
    .innerJoin(users, eq(users.id, habits.userId))
    .where(and(eq(habits.archived, false), isNotNull(habits.reminderTime)));

  const due = candidates.filter(({ habit, timezone }) => {
    const today = todayInTz(timezone, now);
    return (
      habit.lastRemindedOn !== today &&
      habit.reminderTime! <= timeInTz(timezone, now) &&
      isScheduled(habit, today)
    );
  });

  if (due.length) {
    const logs = await db
      .select({ habitId: habitLogs.habitId, date: habitLogs.date, value: habitLogs.value })
      .from(habitLogs)
      .where(inArray(habitLogs.habitId, due.map((d) => d.habit.id)));
    const byHabit = new Map<string, Map<string, number>>();
    for (const l of logs) {
      if (!byHabit.has(l.habitId)) byHabit.set(l.habitId, new Map());
      byHabit.get(l.habitId)!.set(l.date, l.value);
    }

    // group per user to send one notification listing everything pending
    const perUser = new Map<string, { titles: string[]; ids: string[]; today: string }>();
    for (const { habit, timezone, weekStartsOn } of due) {
      const today = todayInTz(timezone, now);
      const hl = byHabit.get(habit.id);
      if (isDone(habit, hl?.get(today))) continue;
      if (habit.frequency === "weekly" && startOfWeekCount(habit, hl, today, weekStartsOn) >= habit.timesPerWeek)
        continue;
      const entry = perUser.get(habit.userId) ?? { titles: [], ids: [], today };
      entry.titles.push(habit.title);
      entry.ids.push(habit.id);
      perUser.set(habit.userId, entry);
    }
    // mark everything we evaluated as reminded today (even done ones) so we don't re-check
    for (const { habit, timezone } of due) {
      await db
        .update(habits)
        .set({ lastRemindedOn: todayInTz(timezone, now) })
        .where(eq(habits.id, habit.id));
    }
    for (const [userId, { titles }] of perUser) {
      const body =
        titles.length === 1 ? `Time for "${titles[0]}"` : `${titles.length} habits waiting: ${titles.slice(0, 4).join(", ")}`;
      await sendToUser(userId, { title: "Habit reminder", body, url: "/today", tag: "habits" });
      habitReminders += titles.length;
    }
  }

  // ---- Task reminders ----
  const dueTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        isNotNull(tasks.reminderAt),
        lte(tasks.reminderAt, now),
        eq(tasks.reminderSent, false),
        isNull(tasks.completedAt),
      ),
    );
  for (const t of dueTasks) {
    await sendToUser(t.userId, { title: "Task reminder", body: t.title, url: "/tasks", tag: `task-${t.id}` });
    taskReminders++;
  }
  if (dueTasks.length) {
    await db
      .update(tasks)
      .set({ reminderSent: true })
      .where(or(...dueTasks.map((t) => eq(tasks.id, t.id))));
  }

  // ---- Reminders (birthdays, events, meetings…) ----
  const alertable = await db
    .select({ r: reminders, timezone: users.timezone })
    .from(reminders)
    .innerJoin(users, eq(users.id, reminders.userId))
    .where(isNotNull(reminders.alertMinutes));
  for (const { r, timezone } of alertable) {
    const nowDay = todayInTz(timezone, now);
    const occ = dueAlert(r, nowDay, timeInTz(timezone, now));
    if (!occ) continue;
    // Mark first, so a slow or failed push never sends the same alert twice.
    await db.update(reminders).set({ lastAlertedFor: occ }).where(eq(reminders.id, r.id));
    const { title, body } = alertText(r, occ, nowDay);
    await sendToUser(r.userId, { title, body, url: `/reminders?date=${occ}`, tag: `reminder-${r.id}-${occ}` });
    eventReminders++;
  }

  return NextResponse.json({ ok: true, habitReminders, taskReminders, eventReminders });
}
