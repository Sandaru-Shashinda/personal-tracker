"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../auth";
import { todayInTz } from "../dates";
import { db, habitLogs, habits } from "../db";

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Not exported: a "use server" file may only export async functions (types are fine).
const habitInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  description: z.string().trim().max(500).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#10b981"),
  icon: z.string().max(40).default("check"),
  categoryId: z.string().uuid().nullable().optional(),
  type: z.enum(["check", "count"]).default("check"),
  target: z.number().positive().max(100000).default(1),
  unit: z.string().trim().max(30).optional().nullable(),
  frequency: z.enum(["daily", "days", "weekly"]).default("daily"),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([0, 1, 2, 3, 4, 5, 6]),
  timesPerWeek: z.number().int().min(1).max(7).default(3),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
  reminderTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  startDate: isoDay.optional(),
});

export type HabitInput = z.input<typeof habitInput>;
type Result = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/", "layout");
}

export async function createHabit(input: HabitInput): Promise<Result> {
  const user = await requireUser();
  const parsed = habitInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (v.frequency === "days" && v.daysOfWeek.length === 0) return { ok: false, error: "Pick at least one day" };
  await db.insert(habits).values({
    ...v,
    target: v.type === "check" ? 1 : v.target,
    userId: user.id,
    startDate: v.startDate ?? todayInTz(user.timezone),
    sortOrder: Date.now() % 2_000_000_000,
  });
  refresh();
  return { ok: true };
}

export async function updateHabit(id: string, input: HabitInput): Promise<Result> {
  const user = await requireUser();
  const parsed = habitInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (v.frequency === "days" && v.daysOfWeek.length === 0) return { ok: false, error: "Pick at least one day" };
  await db
    .update(habits)
    .set({ ...v, target: v.type === "check" ? 1 : v.target, startDate: v.startDate ?? undefined, lastRemindedOn: null })
    .where(and(eq(habits.id, id), eq(habits.userId, user.id)));
  refresh();
  return { ok: true };
}

export async function setHabitArchived(id: string, archived: boolean) {
  const user = await requireUser();
  await db.update(habits).set({ archived }).where(and(eq(habits.id, id), eq(habits.userId, user.id)));
  refresh();
}

export async function deleteHabit(id: string) {
  const user = await requireUser();
  await db.delete(habits).where(and(eq(habits.id, id), eq(habits.userId, user.id)));
  refresh();
}

/** Set a habit's value for a day. value <= 0 clears the log. */
export async function logHabit(habitId: string, date: string, value: number, note?: string | null) {
  const user = await requireUser();
  if (!isoDay.safeParse(date).success) throw new Error("Invalid date");
  if (date > todayInTz(user.timezone)) throw new Error("Can't log the future");
  const [habit] = await db
    .select({ id: habits.id, startDate: habits.startDate })
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, user.id)))
    .limit(1);
  if (!habit) throw new Error("Habit not found");
  if (value > 0 && date < habit.startDate) {
    // backfilling history from before the habit was created: extend its start date
    await db.update(habits).set({ startDate: date }).where(eq(habits.id, habitId));
  }

  if (value <= 0 && !note) {
    await db.delete(habitLogs).where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, date)));
  } else {
    await db
      .insert(habitLogs)
      .values({ habitId, userId: user.id, date, value: Math.max(0, value), note: note ?? null })
      .onConflictDoUpdate({
        target: [habitLogs.habitId, habitLogs.date],
        set: { value: Math.max(0, value), ...(note !== undefined ? { note } : {}) },
      });
  }
  refresh();
}

export async function reorderHabits(ids: string[]) {
  const user = await requireUser();
  await Promise.all(
    ids.map((id, i) =>
      db.update(habits).set({ sortOrder: i }).where(and(eq(habits.id, id), eq(habits.userId, user.id))),
    ),
  );
  refresh();
}
