"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../auth";
import { db, reminders } from "../db";
import { KINDS, REPEATS } from "../reminder-schedule";

const reminderInput = z.object({
  title: z.string().trim().min(1, "Give it a title").max(200),
  kind: z.enum(KINDS),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  repeat: z.enum(REPEATS),
  location: z.string().trim().max(200).nullable(),
  notes: z.string().max(5000).nullable(),
  alertMinutes: z.number().int().min(0).max(60 * 24 * 31).nullable(),
});

export type ReminderInput = z.input<typeof reminderInput>;
type Result = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/reminders");
  revalidatePath("/today");
}

export async function saveReminder(id: string | null, input: ReminderInput): Promise<Result> {
  const user = await requireUser();
  const parsed = reminderInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = { ...parsed.data, location: parsed.data.location || null, notes: parsed.data.notes?.trim() || null };
  if (id) {
    const where = and(eq(reminders.id, id), eq(reminders.userId, user.id));
    const [old] = await db.select().from(reminders).where(where);
    if (!old) return { ok: false, error: "Reminder not found" };
    // Rescheduling starts alert tracking afresh, so the new time alerts even if the old one already did.
    const rescheduled =
      old.date !== v.date || old.time !== v.time || old.repeat !== v.repeat || old.alertMinutes !== v.alertMinutes;
    await db
      .update(reminders)
      .set(rescheduled ? { ...v, lastAlertedFor: null } : v)
      .where(where);
  } else {
    await db.insert(reminders).values({ ...v, userId: user.id });
  }
  revalidate();
  return { ok: true };
}

export async function deleteReminder(id: string) {
  const user = await requireUser();
  await db.delete(reminders).where(and(eq(reminders.id, id), eq(reminders.userId, user.id)));
  revalidate();
}
