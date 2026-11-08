// Client-safe weekly aggregation of logged sets (weeks start on the user's chosen weekday).
import { addDays, startOfWeek } from "../dates";
import { estimate1RM } from "./groups";

type SetLike = { date: string; reps: number | null; weight: number | null; durationSec: number | null };

export type WeekStat = {
  week: string; // first day of the week (YYYY-MM-DD)
  sessions: number;
  sets: number;
  topWeight: number | null; // heaviest weight lifted that week
  topReps: number | null; // reps done at that heaviest weight (best of them)
  best1RM: number | null;
  volume: number; // Σ reps × weight
  maxReps: number | null; // for bodyweight work
  duration: number; // Σ seconds, for timed work
};

/** One entry per week for the last `weeks` weeks (oldest first), including empty weeks. */
export function weeklyStats(sets: SetLike[], weekStartsOn: number, today: string, weeks: number): WeekStat[] {
  const current = startOfWeek(today, weekStartsOn);
  const out: WeekStat[] = Array.from({ length: weeks }, (_, i) => ({
    week: addDays(current, -7 * (weeks - 1 - i)),
    sessions: 0,
    sets: 0,
    topWeight: null,
    topReps: null,
    best1RM: null,
    volume: 0,
    maxReps: null,
    duration: 0,
  }));
  const index = new Map(out.map((w, i) => [w.week, i]));
  const days = out.map(() => new Set<string>());

  for (const s of sets) {
    const i = index.get(startOfWeek(s.date, weekStartsOn));
    if (i === undefined) continue;
    const w = out[i];
    days[i].add(s.date);
    w.sets++;
    w.duration += s.durationSec ?? 0;
    if (s.reps) w.maxReps = Math.max(w.maxReps ?? 0, s.reps);
    if (s.weight && s.reps) {
      w.volume += s.weight * s.reps;
      if (w.topWeight === null || s.weight > w.topWeight || (s.weight === w.topWeight && s.reps > (w.topReps ?? 0))) {
        w.topWeight = s.weight;
        w.topReps = s.reps;
      }
      w.best1RM = Math.max(w.best1RM ?? 0, estimate1RM(s.weight, s.reps));
    } else if (s.weight && w.topWeight === null) {
      w.topWeight = s.weight; // timed set with load
    }
  }
  out.forEach((w, i) => (w.sessions = days[i].size));
  return out;
}

/** Change in top weight vs the most recent earlier week that had any. */
export function weekChange(stats: WeekStat[], i: number): number | null {
  const cur = stats[i].topWeight;
  if (cur === null) return null;
  for (let j = i - 1; j >= 0; j--) if (stats[j].topWeight !== null) return Math.round((cur - stats[j].topWeight!) * 10) / 10;
  return null;
}

/** How many weeks back to look so the user's first logged week is included (clamped). */
export function weeksSince(firstDate: string | undefined, today: string, weekStartsOn: number, min = 8, max = 52) {
  if (!firstDate) return min;
  const a = Date.parse(startOfWeek(firstDate, weekStartsOn) + "T00:00:00Z");
  const b = Date.parse(startOfWeek(today, weekStartsOn) + "T00:00:00Z");
  return Math.min(max, Math.max(min, Math.round((b - a) / (7 * 86_400_000)) + 1));
}
