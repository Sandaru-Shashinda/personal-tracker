// All "day" values in the app are ISO date strings (YYYY-MM-DD) in the user's timezone.
// Arithmetic is done on UTC-midnight Date objects so DST never shifts a day.

export function todayInTz(timezone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Current "HH:MM" wall-clock time in a timezone. */
export function timeInTz(timezone: string, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const h = parts.find((p) => p.type === "hour")?.value ?? "00";
    const m = parts.find((p) => p.type === "minute")?.value ?? "00";
    return `${h}:${m}`;
  } catch {
    return now.toISOString().slice(11, 16);
  }
}

export function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() + n);
  return formatDay(d);
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(day: string): number {
  return parseDay(day).getUTCDay();
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDay(a).getTime() - parseDay(b).getTime()) / 86_400_000);
}

export function startOfWeek(day: string, weekStartsOn = 1): string {
  const dow = dayOfWeek(day);
  const offset = (dow - weekStartsOn + 7) % 7;
  return addDays(day, -offset);
}

export function startOfMonth(day: string): string {
  return day.slice(0, 8) + "01";
}

export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function maxDay(a: string, b: string) {
  return a > b ? a : b;
}

export function minDay(a: string, b: string) {
  return a < b ? a : b;
}

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function prettyDay(day: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return parseDay(day).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    ...opts,
  });
}

export function relativeDayLabel(day: string, today: string): string {
  const diff = diffDays(day, today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return WEEKDAY_LONG[dayOfWeek(day)];
  return prettyDay(day, { weekday: undefined, year: diff < -300 || diff > 300 ? "numeric" : undefined });
}
