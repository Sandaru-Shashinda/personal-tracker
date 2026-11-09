import { and, asc, eq, gte } from "drizzle-orm";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { addDays, todayInTz } from "@/lib/dates";
import { db, gymPlan, workoutSets } from "@/lib/db";
import { getExerciseList } from "@/lib/gym/exercises";
import { GymView } from "./gym-view";

export const metadata: Metadata = { title: "Gym" };

export default async function GymPage() {
  const user = await requireUser();
  const today = todayInTz(user.timezone);
  const planQuery = db
    .select({
      id: gymPlan.id,
      exerciseId: gymPlan.exerciseId,
      exerciseName: gymPlan.exerciseName,
      sets: gymPlan.sets,
      reps: gymPlan.reps,
      weight: gymPlan.weight,
      durationSec: gymPlan.durationSec,
      daysOfWeek: gymPlan.daysOfWeek,
      createdAt: gymPlan.createdAt,
    })
    .from(gymPlan)
    .where(eq(gymPlan.userId, user.id))
    .orderBy(asc(gymPlan.sortOrder), asc(gymPlan.createdAt));
  const setsQuery = db
    .select({
      id: workoutSets.id,
      date: workoutSets.date,
      exerciseId: workoutSets.exerciseId,
      exerciseName: workoutSets.exerciseName,
      reps: workoutSets.reps,
      weight: workoutSets.weight,
      durationSec: workoutSets.durationSec,
    })
    .from(workoutSets)
    .where(and(eq(workoutSets.userId, user.id), gte(workoutSets.date, addDays(today, -730))))
    .orderBy(asc(workoutSets.date), asc(workoutSets.createdAt));
  const [planRows, sets] = await db.batch([planQuery, setsQuery]);
  const plan = planRows.map(({ createdAt, ...p }) => ({ ...p, since: todayInTz(user.timezone, createdAt) }));
  // Only the exercises this page shows right away; the full library loads separately (/api/exercises).
  const used = new Set([...plan.map((p) => p.exerciseId), ...sets.map((s) => s.exerciseId)]);
  const known = getExerciseList().filter((e) => used.has(e.id));

  return <GymView known={known} sets={sets} plan={plan} today={today} weekStartsOn={user.weekStartsOn} />;
}
