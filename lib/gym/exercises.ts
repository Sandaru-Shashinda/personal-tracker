import "server-only";
import data from "./exercises.json";
import type { Exercise, ExerciseLite } from "./groups";

const ALL = data as Exercise[];
const BY_ID = new Map(ALL.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

let lite: ExerciseLite[] | null = null;
export function getExerciseList(): ExerciseLite[] {
  lite ??= ALL.map(({ id, name, level, equipment, category, primary, img }) => ({
    id,
    name,
    level,
    equipment,
    category,
    primary,
    img,
  }));
  return lite;
}
