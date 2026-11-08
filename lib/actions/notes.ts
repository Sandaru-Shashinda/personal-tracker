"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../auth";
import { db, notes } from "../db";

const noteInput = z.object({
  title: z.string().trim().max(200),
  content: z.string().max(50_000),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
  pinned: z.boolean(),
});

type Result = { ok: true; id: string } | { ok: false; error: string };

export async function saveNote(id: string | null, input: z.input<typeof noteInput>): Promise<Result> {
  const user = await requireUser();
  const parsed = noteInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (!v.title && !v.content.trim()) return { ok: false, error: "Note is empty" };
  let noteId = id;
  if (id) {
    await db
      .update(notes)
      .set({ ...v, updatedAt: new Date() })
      .where(and(eq(notes.id, id), eq(notes.userId, user.id)));
  } else {
    const [row] = await db.insert(notes).values({ ...v, userId: user.id }).returning({ id: notes.id });
    noteId = row.id;
  }
  revalidatePath("/notes");
  return { ok: true, id: noteId! };
}

export async function setNotePinned(id: string, pinned: boolean) {
  const user = await requireUser();
  await db
    .update(notes)
    .set({ pinned })
    .where(and(eq(notes.id, id), eq(notes.userId, user.id)));
  revalidatePath("/notes");
}

export async function deleteNote(id: string) {
  const user = await requireUser();
  await db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, user.id)));
  revalidatePath("/notes");
}
