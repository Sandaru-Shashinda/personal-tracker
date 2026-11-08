"use server";

import { and, eq, isNotNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../auth";
import { db, tasks } from "../db";

const taskInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  notes: z.string().trim().max(5000).optional().nullable(),
  priority: z.number().int().min(0).max(3).default(0),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  categoryId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
  reminderAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export type TaskInput = z.input<typeof taskInput>;
type Result = { ok: true; id: string } | { ok: false; error: string };

function refresh() {
  revalidatePath("/", "layout");
}

export async function createTask(input: TaskInput): Promise<Result> {
  const user = await requireUser();
  const parsed = taskInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (v.parentId) {
    const [parent] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, v.parentId), eq(tasks.userId, user.id)))
      .limit(1);
    if (!parent) return { ok: false, error: "Parent task not found" };
  }
  const [row] = await db
    .insert(tasks)
    .values({ ...v, userId: user.id, reminderAt: v.reminderAt ? new Date(v.reminderAt) : null })
    .returning({ id: tasks.id });
  refresh();
  return { ok: true, id: row.id };
}

export async function updateTask(id: string, input: TaskInput): Promise<Result> {
  const user = await requireUser();
  const parsed = taskInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const { parentId: _ignored, ...rest } = v;
  void _ignored;
  await db
    .update(tasks)
    .set({
      ...rest,
      reminderAt: v.reminderAt ? new Date(v.reminderAt) : null,
      reminderSent: false,
    })
    .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)));
  refresh();
  return { ok: true, id };
}

export async function toggleTask(id: string, done: boolean) {
  const user = await requireUser();
  await db
    .update(tasks)
    .set({ completedAt: done ? new Date() : null })
    .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)));
  refresh();
}

export async function deleteTask(id: string) {
  const user = await requireUser();
  // remove subtasks too
  await db
    .delete(tasks)
    .where(and(eq(tasks.userId, user.id), or(eq(tasks.id, id), eq(tasks.parentId, id))));
  refresh();
}

export async function clearCompletedTasks() {
  const user = await requireUser();
  await db.delete(tasks).where(and(eq(tasks.userId, user.id), isNotNull(tasks.completedAt)));
  refresh();
}
