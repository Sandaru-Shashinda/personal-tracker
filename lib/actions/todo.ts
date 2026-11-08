"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../auth";
import { db, todoItems, todoLists } from "../db";

type Result = { ok: true; id: string } | { ok: false; error: string };

const listInput = z.object({
  name: z.string().trim().min(1, "Name the list").max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
const itemText = z.string().trim().min(1, "Item is empty").max(500);

function refresh() {
  revalidatePath("/todo");
}

export async function saveList(id: string | null, input: z.input<typeof listInput>): Promise<Result> {
  const user = await requireUser();
  const parsed = listInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (id) {
    await db
      .update(todoLists)
      .set(parsed.data)
      .where(and(eq(todoLists.id, id), eq(todoLists.userId, user.id)));
    refresh();
    return { ok: true, id };
  }
  const [row] = await db
    .insert(todoLists)
    .values({ ...parsed.data, userId: user.id })
    .returning({ id: todoLists.id });
  refresh();
  return { ok: true, id: row.id };
}

export async function deleteList(id: string) {
  const user = await requireUser();
  await db.delete(todoLists).where(and(eq(todoLists.id, id), eq(todoLists.userId, user.id)));
  refresh();
}

export async function addItem(listId: string, text: string): Promise<Result> {
  const user = await requireUser();
  const parsed = itemText.safeParse(text);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const [list] = await db
    .select({ id: todoLists.id })
    .from(todoLists)
    .where(and(eq(todoLists.id, listId), eq(todoLists.userId, user.id)))
    .limit(1);
  if (!list) return { ok: false, error: "List not found" };
  const [row] = await db
    .insert(todoItems)
    .values({ listId, userId: user.id, text: parsed.data })
    .returning({ id: todoItems.id });
  refresh();
  return { ok: true, id: row.id };
}

export async function toggleItem(id: string, done: boolean) {
  const user = await requireUser();
  await db
    .update(todoItems)
    .set({ done })
    .where(and(eq(todoItems.id, id), eq(todoItems.userId, user.id)));
  refresh();
}

export async function renameItem(id: string, text: string): Promise<Result> {
  const user = await requireUser();
  const parsed = itemText.safeParse(text);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  await db
    .update(todoItems)
    .set({ text: parsed.data })
    .where(and(eq(todoItems.id, id), eq(todoItems.userId, user.id)));
  refresh();
  return { ok: true, id };
}

export async function deleteItem(id: string) {
  const user = await requireUser();
  await db.delete(todoItems).where(and(eq(todoItems.id, id), eq(todoItems.userId, user.id)));
  refresh();
}

export async function clearDoneItems(listId: string) {
  const user = await requireUser();
  await db
    .delete(todoItems)
    .where(and(eq(todoItems.listId, listId), eq(todoItems.userId, user.id), eq(todoItems.done, true)));
  refresh();
}
