"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../auth";
import { todayInTz } from "../dates";
import { db, workoutSets } from "../db";
import { getExercise } from "../gym/exercises";

type Result = { ok: true } | { ok: false; error: string };

const setInput = z.object({
  reps: z.number().int().min(0).max(1000).nullable().optional(),
  weight: z.number().min(0).max(2000).nullable().optional(),
  durationSec: z.number().int().min(0).max(86_400).nullable().optional(),
});

function refresh() {
  revalidatePath("/gym", "layout");
}

export async function addSet(date: string, exerciseId: string, input: z.input<typeof setInput>): Promise<Result> {
  const user = await requireUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Invalid date" };
  if (date > todayInTz(user.timezone)) return { ok: false, error: "Can't log a future workout" };
  const exercise = getExercise(exerciseId);
  if (!exercise) return { ok: false, error: "Unknown exercise" };
  const parsed = setInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (!v.reps && !v.durationSec) return { ok: false, error: "Enter reps or a duration" };
  await db.insert(workoutSets).values({
    userId: user.id,
    date,
    exerciseId,
    exerciseName: exercise.name,
    reps: v.reps ?? null,
    weight: v.weight ?? null,
    durationSec: v.durationSec ?? null,
  });
  refresh();
  return { ok: true };
}

export async function updateSet(id: string, input: z.input<typeof setInput>): Promise<Result> {
  const user = await requireUser();
  const parsed = setInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  await db
    .update(workoutSets)
    .set({ reps: v.reps ?? null, weight: v.weight ?? null, durationSec: v.durationSec ?? null })
    .where(and(eq(workoutSets.id, id), eq(workoutSets.userId, user.id)));
  refresh();
  return { ok: true };
}

export async function deleteSet(id: string) {
  const user = await requireUser();
  await db.delete(workoutSets).where(and(eq(workoutSets.id, id), eq(workoutSets.userId, user.id)));
  refresh();
}

/** Remove every set of one exercise from a day's workout. */
export async function removeExerciseFromDay(date: string, exerciseId: string) {
  const user = await requireUser();
  await db
    .delete(workoutSets)
    .where(and(eq(workoutSets.userId, user.id), eq(workoutSets.date, date), eq(workoutSets.exerciseId, exerciseId)));
  refresh();
}
