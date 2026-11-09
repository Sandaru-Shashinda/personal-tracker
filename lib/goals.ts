import type { Goal, GoalMilestone } from "./db/schema";

/** 0–1 progress: by target value when set, otherwise by milestones ticked. */
export function progressOf(g: Pick<Goal, "targetValue" | "currentValue" | "status">, ms: Pick<GoalMilestone, "done">[]) {
  if (g.targetValue) return Math.min(1, g.currentValue / g.targetValue);
  if (ms.length) return ms.filter((m) => m.done).length / ms.length;
  return g.status === "completed" ? 1 : 0;
}
