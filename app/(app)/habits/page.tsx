import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays, todayInTz } from "@/lib/dates";
import { getCategories, getHabits, getLogs } from "@/lib/queries";
import { computeStreak, habitCompletion, indexLogs } from "@/lib/stats";
import { HabitsManager } from "./habits-manager";

export const metadata: Metadata = { title: "Habits" };

export default async function HabitsPage() {
  const user = await requireUser();
  const today = todayInTz(user.timezone);
  const [habits, categories, logs] = await db.batch([
    getHabits(user.id, { includeArchived: true }),
    getCategories(user.id),
    getLogs(user.id, addDays(today, -800), today),
  ]);
  const idx = indexLogs(logs);
  const stats = Object.fromEntries(
    habits.map((h) => {
      const c = habitCompletion(h, idx.get(h.id), addDays(today, -29), today, user.weekStartsOn, today);
      const s = computeStreak(h, idx.get(h.id), today, user.weekStartsOn);
      const total = [...(idx.get(h.id)?.entries() ?? [])].filter(([, v]) => v >= h.target).length;
      return [h.id, { streak: s.current, best: s.best, unit: s.unit, rate: c.expected ? c.done / c.expected : null, total }];
    }),
  );
  return <HabitsManager habits={habits} categories={categories} stats={stats} />;
}
