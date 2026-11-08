import { WEEKDAY_SHORT } from "./dates";
import type { Habit } from "./db/schema";

export function frequencyLabel(h: Pick<Habit, "frequency" | "timesPerWeek" | "daysOfWeek">) {
  if (h.frequency === "daily") return "Every day";
  if (h.frequency === "weekly") return `${h.timesPerWeek}× per week`;
  if (h.daysOfWeek.length === 5 && [1, 2, 3, 4, 5].every((d) => h.daysOfWeek.includes(d))) return "Weekdays";
  if (h.daysOfWeek.length === 2 && h.daysOfWeek.includes(0) && h.daysOfWeek.includes(6)) return "Weekends";
  return h.daysOfWeek.map((d) => WEEKDAY_SHORT[d]).join(", ");
}
