import { addDays, startOfWeek } from "./dates";
import type { Habit } from "./db/schema";
import { computeStreak, habitCompletion, isDone, isScheduled, type LogIndex, type StreakInfo } from "./stats";

export type HabitDayView = {
  habit: Habit;
  value: number;
  done: boolean;
  scheduled: boolean;
  streak: StreakInfo;
  weekDone: number; // completions in the current week (for weekly habits)
  last7: { date: string; done: boolean; scheduled: boolean }[];
  rate30: number | null;
};

export function buildHabitDayViews(
  habits: Habit[],
  idx: LogIndex,
  date: string,
  today: string,
  weekStartsOn: number,
): HabitDayView[] {
  return habits.map((habit) => {
    const logs = idx.get(habit.id);
    const value = logs?.get(date) ?? 0;
    const ws = startOfWeek(date, weekStartsOn);
    let weekDone = 0;
    for (let d = ws; d <= date; d = addDays(d, 1)) if (isDone(habit, logs?.get(d))) weekDone++;
    const weekQuotaMet = habit.frequency === "weekly" && weekDone >= habit.timesPerWeek && !isDone(habit, value);
    const c = habitCompletion(habit, logs, addDays(today, -29), today, weekStartsOn, today);
    return {
      habit,
      value,
      done: isDone(habit, value),
      scheduled: isScheduled(habit, date) && !weekQuotaMet,
      streak: computeStreak(habit, logs, today, weekStartsOn),
      weekDone,
      rate30: c.expected ? c.done / c.expected : null,
      last7: Array.from({ length: 7 }, (_, i) => {
        const d = addDays(date, i - 6);
        return { date: d, done: isDone(habit, logs?.get(d)), scheduled: isScheduled(habit, d) };
      }),
    };
  });
}
