"use server";

import { and, desc, eq, inArray, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../auth";
import { todayInTz } from "../dates";
import { db, gymPlan, workoutSets } from "../db";
import { getExercise } from "../gym/exercises";
import { isTimed } from "../gym/groups";

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

// --- Plan: the user's chosen exercises, ticked off day by day ----------------------------------

const planInput = z.object({
  sets: z.number().int().min(1).max(20),
  reps: z.number().int().min(1).max(1000).nullable(),
  weight: z.number().min(0).max(2000).nullable(),
  durationSec: z.number().int().min(1).max(86_400).nullable(),
});
const daysInput = z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one day").max(7);

/** Add exercises to the plan. Targets start from the last time the exercise was logged. */
export async function addToPlan(exerciseIds: string[]): Promise<Result> {
  const user = await requireUser();
  const exercises = [...new Set(exerciseIds)].map(getExercise).filter((e) => !!e);
  if (!exercises.length) return { ok: false, error: "Pick at least one exercise" };
  const [{ top }] = await db.select({ top: max(gymPlan.sortOrder) }).from(gymPlan).where(eq(gymPlan.userId, user.id));
  const recent = await db
    .select({ exerciseId: workoutSets.exerciseId, reps: workoutSets.reps, weight: workoutSets.weight, durationSec: workoutSets.durationSec })
    .from(workoutSets)
    .where(and(eq(workoutSets.userId, user.id), inArray(workoutSets.exerciseId, exercises.map((e) => e.id))))
    .orderBy(desc(workoutSets.date), desc(workoutSets.createdAt));
  const last = new Map<string, (typeof recent)[number]>();
  for (const r of recent) if (!last.has(r.exerciseId)) last.set(r.exerciseId, r);

  await db
    .insert(gymPlan)
    .values(
      exercises.map((e, i) => {
        const prev = last.get(e.id);
        const timed = isTimed(e);
        return {
          userId: user.id,
          exerciseId: e.id,
          exerciseName: e.name,
          sets: timed ? 1 : 3,
          reps: timed ? null : (prev?.reps ?? 10),
          weight: prev?.weight ?? null,
          durationSec: timed ? (prev?.durationSec ?? 300) : null,
          sortOrder: (top ?? -1) + 1 + i,
        };
      }),
    )
    .onConflictDoNothing();
  refresh();
  return { ok: true };
}

export async function updatePlanItem(
  id: string,
  input: z.input<typeof planInput> & { daysOfWeek: number[] },
): Promise<Result> {
  const user = await requireUser();
  const parsed = planInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const days = daysInput.safeParse(input.daysOfWeek);
  if (!days.success) return { ok: false, error: days.error.issues[0].message };
  await db
    .update(gymPlan)
    .set({ ...parsed.data, daysOfWeek: [...new Set(days.data)].sort() })
    .where(and(eq(gymPlan.id, id), eq(gymPlan.userId, user.id)));
  refresh();
  return { ok: true };
}

export async function removeFromPlan(id: string) {
  const user = await requireUser();
  await db.delete(gymPlan).where(and(eq(gymPlan.id, id), eq(gymPlan.userId, user.id)));
  refresh();
}

export async function reorderPlan(ids: string[]) {
  const user = await requireUser();
  await Promise.all(ids.map((id, i) => db.update(gymPlan).set({ sortOrder: i }).where(and(eq(gymPlan.id, id), eq(gymPlan.userId, user.id)))));
  refresh();
}

/**
 * Tick a plan exercise as done on `date`: logs `sets` rows with the given reps/weight (or
 * duration) and saves them as the new targets, so next time starts from what was lifted.
 */
export async function completePlanItem(date: string, id: string, input: z.input<typeof planInput>): Promise<Result> {
  const user = await requireUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Invalid date" };
  if (date > todayInTz(user.timezone)) return { ok: false, error: "Can't log a future workout" };
  const parsed = planInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (!v.reps && !v.durationSec) return { ok: false, error: "Enter reps or a duration" };
  const [item] = await db
    .select()
    .from(gymPlan)
    .where(and(eq(gymPlan.id, id), eq(gymPlan.userId, user.id)))
    .limit(1);
  if (!item) return { ok: false, error: "Exercise is no longer in your plan" };

  await db
    .delete(workoutSets)
    .where(and(eq(workoutSets.userId, user.id), eq(workoutSets.date, date), eq(workoutSets.exerciseId, item.exerciseId)));
  await db.insert(workoutSets).values(
    Array.from({ length: v.sets }, () => ({
      userId: user.id,
      date,
      exerciseId: item.exerciseId,
      exerciseName: item.exerciseName,
      reps: v.reps,
      weight: v.weight,
      durationSec: v.durationSec,
    })),
  );
  await db.update(gymPlan).set(v).where(eq(gymPlan.id, item.id));
  refresh();
  return { ok: true };
}
