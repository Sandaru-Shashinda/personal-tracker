"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../auth";
import { db, goalMilestones, goals } from "../db";

type Result = { ok: true; id: string } | { ok: false; error: string };

const goalInput = z.object({
  title: z.string().trim().min(1, "Give your goal a title").max(150),
  description: z.string().trim().max(2000).nullable(),
  area: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  targetValue: z.number().positive("Target must be more than 0").max(1e12).nullable(),
  currentValue: z.number().min(0).max(1e12),
  unit: z.string().trim().max(30).nullable(),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

function refresh() {
  revalidatePath("/goals");
}

async function ownGoal(userId: string, id: string) {
  const [g] = await db
    .select({ id: goals.id, targetValue: goals.targetValue, status: goals.status })
    .from(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .limit(1);
  return g;
}

export async function saveGoal(
  id: string | null,
  input: z.input<typeof goalInput>,
  milestones: string[] = [],
): Promise<Result> {
  const user = await requireUser();
  const parsed = goalInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (id) {
    await db
      .update(goals)
      .set(v)
      .where(and(eq(goals.id, id), eq(goals.userId, user.id)));
    refresh();
    return { ok: true, id };
  }
  const [row] = await db
    .insert(goals)
    .values({ ...v, userId: user.id })
    .returning({ id: goals.id });
  const titles = milestones.map((m) => m.trim()).filter(Boolean).slice(0, 50);
  if (titles.length) {
    await db.insert(goalMilestones).values(titles.map((title) => ({ title: title.slice(0, 200), goalId: row.id, userId: user.id })));
  }
  refresh();
  return { ok: true, id: row.id };
}

export async function setGoalProgress(id: string, value: number): Promise<Result> {
  const user = await requireUser();
  if (!Number.isFinite(value) || value < 0 || value > 1e12) return { ok: false, error: "Invalid value" };
  const g = await ownGoal(user.id, id);
  if (!g) return { ok: false, error: "Goal not found" };
  const reached = g.targetValue !== null && value >= g.targetValue;
  await db
    .update(goals)
    .set({
      currentValue: value,
      ...(reached && g.status === "active" ? { status: "completed", completedAt: new Date() } : {}),
    })
    .where(eq(goals.id, id));
  refresh();
  return { ok: true, id };
}

export async function setGoalStatus(id: string, status: "active" | "completed" | "archived") {
  const user = await requireUser();
  await db
    .update(goals)
    .set({ status, completedAt: status === "completed" ? new Date() : null })
    .where(and(eq(goals.id, id), eq(goals.userId, user.id)));
  refresh();
}

export async function deleteGoal(id: string) {
  const user = await requireUser();
  await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, user.id)));
  refresh();
}

export async function addMilestone(goalId: string, title: string): Promise<Result> {
  const user = await requireUser();
  const t = title.trim();
  if (!t || t.length > 200) return { ok: false, error: "Milestone needs a title" };
  if (!(await ownGoal(user.id, goalId))) return { ok: false, error: "Goal not found" };
  const [row] = await db
    .insert(goalMilestones)
    .values({ goalId, userId: user.id, title: t })
    .returning({ id: goalMilestones.id });
  refresh();
  return { ok: true, id: row.id };
}

export async function toggleMilestone(id: string, done: boolean) {
  const user = await requireUser();
  await db
    .update(goalMilestones)
    .set({ done })
    .where(and(eq(goalMilestones.id, id), eq(goalMilestones.userId, user.id)));
  refresh();
}

export async function deleteMilestone(id: string) {
  const user = await requireUser();
  await db.delete(goalMilestones).where(and(eq(goalMilestones.id, id), eq(goalMilestones.userId, user.id)));
  refresh();
}
