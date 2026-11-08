import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExerciseAnim } from "@/components/exercise-anim";
import { requireUser } from "@/lib/auth";
import { todayInTz } from "@/lib/dates";
import { db, workoutSets } from "@/lib/db";
import { getExercise } from "@/lib/gym/exercises";
import { capitalize, GROUP_BY_MUSCLE, groupOf } from "@/lib/gym/groups";
import { ExerciseLog } from "./exercise-log";

export async function generateMetadata({ params }: PageProps<"/gym/exercises/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: getExercise(id)?.name ?? "Exercise" };
}

export default async function ExercisePage({ params }: PageProps<"/gym/exercises/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const ex = getExercise(id);
  if (!ex) notFound();
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
    .where(and(eq(workoutSets.userId, user.id), eq(workoutSets.exerciseId, id)))
    .orderBy(asc(workoutSets.date), asc(workoutSets.createdAt));
  const group = groupOf(ex);
  const facts = [
    ["Equipment", ex.equipment],
    ["Level", ex.level],
    ["Type", ex.category],
    ["Mechanic", ex.mechanic],
    ["Force", ex.force],
  ].filter((f): f is [string, string] => !!f[1]);

  return (
    <div className="space-y-6">
      <Link href="/gym" className="inline-flex items-center gap-1 text-sm text-text-2 hover:text-text">
        <ArrowLeft className="size-4" /> Gym
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-3">
          <ExerciseAnim id={ex.id} name={ex.name} img={ex.img} className="border border-border" />
          <p className="text-center text-xs text-text-3">Start ↔ end position, looping</p>
        </div>
        <div className="space-y-5">
          <div>
            {group && (
              <span
                className="mb-2 inline-flex rounded-md px-2 py-0.5 text-xs font-medium"
                style={{ background: `${group.color}1f`, color: group.color }}
              >
                {group.label}
              </span>
            )}
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{ex.name}</h1>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-text-3">{k}</dt>
                <dd className="font-medium">{capitalize(v)}</dd>
              </div>
            ))}
          </dl>
          <div>
            <h2 className="mb-2 text-sm font-semibold">Muscles worked</h2>
            <div className="flex flex-wrap gap-1.5">
              {ex.primary.map((m) => (
                <MuscleChip key={m} muscle={m} primary />
              ))}
              {ex.secondary.map((m) => (
                <MuscleChip key={m} muscle={m} />
              ))}
            </div>
          </div>
          {ex.instructions.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold">How to do it</h2>
              <ol className="space-y-2">
                {ex.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-text-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-text">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      <ExerciseLog
        exercise={{ id: ex.id, name: ex.name, category: ex.category }}
        sets={sets}
        today={todayInTz(user.timezone)}
        weekStartsOn={user.weekStartsOn}
      />
    </div>
  );
}

function MuscleChip({ muscle, primary }: { muscle: string; primary?: boolean }) {
  const g = GROUP_BY_MUSCLE.get(muscle);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs"
      title={primary ? "Primary muscle" : "Secondary muscle"}
    >
      <span
        className="size-2 rounded-full"
        style={{ background: primary ? (g?.color ?? "var(--accent)") : "transparent", border: `1.5px solid ${g?.color ?? "var(--accent)"}` }}
        aria-hidden
      />
      {capitalize(muscle)}
      {primary && <span className="text-text-3">· primary</span>}
    </span>
  );
}
