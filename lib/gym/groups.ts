// Client-safe gym helpers: muscle-group categories and exercise image URLs.
// Exercise data: free-exercise-db (public domain, https://github.com/yuhonas/free-exercise-db).

const IMAGE_BASE = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises";

export function exerciseImage(id: string, frame: 0 | 1) {
  return `${IMAGE_BASE}/${id}/${frame}.jpg`;
}

/** Light exercise record sent to the browser (instructions are only loaded on the detail page). */
export type ExerciseLite = {
  id: string;
  name: string;
  level: string;
  equipment: string;
  category: string;
  primary: string[];
  img: boolean;
};

export type Exercise = ExerciseLite & {
  force: string | null;
  mechanic: string | null;
  secondary: string[];
  instructions: string[];
};

export type MuscleGroup = { key: string; label: string; muscles: string[]; color: string };

/** User-facing categories. Each maps to one or more muscles from the dataset. */
export const MUSCLE_GROUPS: MuscleGroup[] = [
  { key: "chest", label: "Chest", muscles: ["chest"], color: "#e34948" },
  { key: "back", label: "Back", muscles: ["lats", "middle back"], color: "#2a78d6" },
  { key: "shoulders", label: "Shoulders", muscles: ["shoulders"], color: "#eb6834" },
  { key: "biceps", label: "Biceps", muscles: ["biceps"], color: "#6250d6" },
  { key: "triceps", label: "Triceps", muscles: ["triceps"], color: "#e87ba4" },
  { key: "forearms", label: "Forearms", muscles: ["forearms"], color: "#64748b" },
  { key: "abs", label: "Abs", muscles: ["abdominals"], color: "#eda100" },
  { key: "quads", label: "Quads", muscles: ["quadriceps"], color: "#1baf7a" },
  { key: "hamstrings", label: "Hamstrings", muscles: ["hamstrings"], color: "#008300" },
  { key: "glutes", label: "Glutes", muscles: ["glutes", "abductors", "adductors"], color: "#0ea5e9" },
  { key: "calves", label: "Calves", muscles: ["calves"], color: "#14b8a6" },
  { key: "traps", label: "Traps & neck", muscles: ["traps", "neck"], color: "#a16207" },
  { key: "lowerback", label: "Lower back", muscles: ["lower back"], color: "#7c3aed" },
];

export const GROUP_BY_MUSCLE = new Map(MUSCLE_GROUPS.flatMap((g) => g.muscles.map((m) => [m, g] as const)));

export function groupOf(e: Pick<ExerciseLite, "primary">): MuscleGroup | undefined {
  return GROUP_BY_MUSCLE.get(e.primary[0]);
}

export const EXERCISE_TYPES = ["strength", "stretching", "cardio", "plyometrics", "powerlifting", "olympic weightlifting", "strongman"];

/** Exercises timed rather than counted in reps. */
export function isTimed(e: Pick<ExerciseLite, "category">) {
  return e.category === "cardio" || e.category === "stretching";
}

/** Epley estimated one-rep max. */
export function estimate1RM(weight: number, reps: number) {
  return reps <= 1 ? weight : weight * (1 + reps / 30);
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
