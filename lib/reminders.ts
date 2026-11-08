import { addDays, startOfWeek } from "./dates";
import { isDone, type HabitLike } from "./stats";

export { isDone, isScheduled } from "./stats";

/** Number of completions so far in the week containing `today`. */
export function startOfWeekCount(
  habit: Pick<HabitLike, "target">,
  logs: Map<string, number> | undefined,
  today: string,
  weekStartsOn: number,
) {
  if (!logs) return 0;
  let n = 0;
  for (let d = startOfWeek(today, weekStartsOn); d <= today; d = addDays(d, 1)) {
    if (isDone(habit as HabitLike, logs.get(d))) n++;
  }
  return n;
}
