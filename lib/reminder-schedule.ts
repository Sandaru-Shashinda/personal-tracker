// Pure scheduling helpers for reminders, shared by the calendar UI and the cron job.
// Days are "YYYY-MM-DD" and times "HH:MM", both in the user's own timezone.

import { addDays, diffDays, parseDay } from "./dates";

export const KINDS = ["birthday", "anniversary", "event", "meeting", "bill", "other"] as const;
export type Kind = (typeof KINDS)[number];

export const KIND_META: Record<Kind, { label: string; color: string; emoji: string }> = {
  birthday: { label: "Birthday", color: "#e87ba4", emoji: "🎂" },
  anniversary: { label: "Anniversary", color: "#e34948", emoji: "💝" },
  event: { label: "Event", color: "#6250d6", emoji: "📅" },
  meeting: { label: "Meeting", color: "#2a78d6", emoji: "👥" },
  bill: { label: "Bill", color: "#eda100", emoji: "🧾" },
  other: { label: "Other", color: "#64748b", emoji: "🔔" },
};

export const kindMeta = (k: string) => KIND_META[(KINDS as readonly string[]).includes(k) ? (k as Kind) : "other"];

export const REPEATS = ["none", "daily", "weekly", "monthly", "yearly"] as const;
export type Repeat = (typeof REPEATS)[number];
export const REPEAT_LABEL: Record<Repeat, string> = {
  none: "Does not repeat",
  daily: "Every day",
  weekly: "Every week",
  monthly: "Every month",
  yearly: "Every year",
};

/** All-day reminders alert relative to this local time. */
export const ALL_DAY_ALERT_TIME = "09:00";

export const ALERTS_TIMED: { v: number | null; label: string }[] = [
  { v: null, label: "No alert" },
  { v: 0, label: "At start time" },
  { v: 10, label: "10 minutes before" },
  { v: 30, label: "30 minutes before" },
  { v: 60, label: "1 hour before" },
  { v: 120, label: "2 hours before" },
  { v: 1440, label: "1 day before" },
  { v: 10080, label: "1 week before" },
];
export const ALERTS_ALL_DAY: { v: number | null; label: string }[] = [
  { v: null, label: "No alert" },
  { v: 0, label: "On the day (9 AM)" },
  { v: 1440, label: "1 day before (9 AM)" },
  { v: 2880, label: "2 days before (9 AM)" },
  { v: 10080, label: "1 week before (9 AM)" },
];

export type Schedulable = { date: string; repeat: string };

const pad = (n: number) => String(n).padStart(2, "0");
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** A date in month `m` (1-12) of year `y`, clamped to the month's last day (Jan 31 → Feb 28, Feb 29 → Feb 28). */
const clampDay = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(Math.min(d, daysInMonth(y, m)))}`;

/** Every occurrence of `r` within [from, to] (inclusive), in ascending order. */
export function occurrencesBetween(r: Schedulable, from: string, to: string): string[] {
  const start = r.date;
  if (to < start || to < from) return [];
  const lo = from > start ? from : start;
  const out: string[] = [];
  const [, sm, sd] = start.split("-").map(Number);
  const [ly, lm] = lo.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);

  switch (r.repeat) {
    case "daily":
      for (let d = lo; d <= to; d = addDays(d, 1)) out.push(d);
      break;
    case "weekly": {
      const off = (((diffDays(lo, start) % 7) + 7) % 7);
      for (let d = off ? addDays(lo, 7 - off) : lo; d <= to; d = addDays(d, 7)) out.push(d);
      break;
    }
    case "monthly":
      for (let y = ly, m = lm; y < ty || (y === ty && m <= tm); m === 12 ? ((m = 1), y++) : m++) {
        const d = clampDay(y, m, sd);
        if (d >= lo && d <= to) out.push(d);
      }
      break;
    case "yearly":
      for (let y = ly; y <= ty; y++) {
        const d = clampDay(y, sm, sd);
        if (d >= lo && d <= to) out.push(d);
      }
      break;
    default:
      if (start >= from && start <= to) out.push(start);
  }
  return out;
}

/** The first occurrence on or after `from`, or null if there are none left. */
export function nextOccurrence(r: Schedulable, from: string): string | null {
  if (r.repeat === "none") return r.date >= from ? r.date : null;
  if (r.repeat === "daily") return r.date > from ? r.date : from;
  return occurrencesBetween(r, from, addDays(from, 400))[0] ?? null;
}

/** Years since the original date, e.g. the age a birthday marks. Null for non-yearly or year 0. */
export function yearsOn(r: Schedulable & { kind?: string }, occurrence: string): number | null {
  if (r.repeat !== "yearly") return null;
  const n = Number(occurrence.slice(0, 4)) - Number(r.date.slice(0, 4));
  return n > 0 ? n : null;
}

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** "Turns 30" for birthdays, "5th anniversary", etc. */
export function milestoneLabel(r: Schedulable & { kind: string }, occurrence: string): string | null {
  const n = yearsOn(r, occurrence);
  if (n === null) return null;
  if (r.kind === "birthday") return `Turns ${n}`;
  if (r.kind === "anniversary") return `${ordinal(n)} anniversary`;
  return `${ordinal(n)} year`;
}

/** "YYYY-MM-DD HH:MM" local wall-clock, shifted by `minutes`. */
export function shiftLocal(day: string, time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const t = parseDay(day).getTime() + (h * 60 + m + minutes) * 60_000;
  return new Date(t).toISOString().slice(0, 16).replace("T", " ");
}

export type Alertable = Schedulable & { time: string | null; alertMinutes: number | null; lastAlertedFor: string | null };

/**
 * The occurrence whose alert is due at local time `nowDay nowTime`, or null. An alert is due once its
 * alert time has passed, at most 24 hours ago (so a reminder created after the fact doesn't fire),
 * and only once per occurrence (tracked in `lastAlertedFor`).
 */
export function dueAlert(r: Alertable, nowDay: string, nowTime: string): string | null {
  if (r.alertMinutes === null || r.alertMinutes === undefined) return null;
  const now = `${nowDay} ${nowTime}`;
  const time = r.time ?? ALL_DAY_ALERT_TIME;
  const lead = Math.ceil(r.alertMinutes / 1440) + 1;
  let due: string | null = null;
  for (const occ of occurrencesBetween(r, addDays(nowDay, -2), addDays(nowDay, lead))) {
    if (r.lastAlertedFor && occ <= r.lastAlertedFor) continue;
    const at = shiftLocal(occ, time, -r.alertMinutes);
    const expires = shiftLocal(occ, time, -r.alertMinutes + 24 * 60);
    if (at <= now && now < expires) due = occ;
  }
  return due;
}

/** Notification text for an occurrence, e.g. "Sam turns 30 tomorrow" or "Standup at 09:30". */
export function alertText(r: Alertable & { title: string; kind: string; location?: string | null }, occ: string, nowDay: string) {
  const meta = kindMeta(r.kind);
  const days = diffDays(occ, nowDay);
  const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  const n = yearsOn(r, occ);
  let body: string;
  if (r.kind === "birthday") body = `${r.title}'s birthday is ${when}${n ? ` (turns ${n})` : ""}`;
  else if (r.kind === "anniversary") body = `${r.title} is ${when}${n ? ` (${ordinal(n)})` : ""}`;
  else body = `${r.title} ${when}${r.time ? ` at ${formatTime(r.time)}` : ""}`;
  if (r.location) body += ` · ${r.location}`;
  return { title: `${meta.emoji} ${meta.label}`, body };
}

/** "14:30" → "2:30 PM". */
export function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ap = h < 12 ? "AM" : "PM";
  return `${h % 12 || 12}:${pad(m)} ${ap}`;
}
