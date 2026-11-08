import { and, asc, eq, gte } from "drizzle-orm";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { addDays, todayInTz } from "@/lib/dates";
import { db, workoutSets } from "@/lib/db";
import { getExerciseList } from "@/lib/gym/exercises";
import { GymView } from "./gym-view";

export const metadata: Metadata = { title: "Gym" };

export default async function GymPage() {
  const user = await requireUser();
  const today = todayInTz(user.timezone);
  const sets = await db
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

  return <GymView exercises={getExerciseList()} sets={sets} today={today} weekStartsOn={user.weekStartsOn} />;
}
