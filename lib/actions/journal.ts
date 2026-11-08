"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../auth";
import { todayInTz } from "../dates";
import { db, journalEntries } from "../db";

const entryInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mood: z.number().int().min(1).max(5).nullable().optional(),
  energy: z.number().int().min(1).max(5).nullable().optional(),
  content: z.string().max(20000).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
});

export type EntryInput = z.input<typeof entryInput>;

/** Upsert: only the provided fields are changed. */
export async function saveJournalEntry(input: EntryInput) {
  const user = await requireUser();
  const v = entryInput.parse(input);
  if (v.date > todayInTz(user.timezone)) throw new Error("Can't write entries for the future");
  const set: Partial<typeof journalEntries.$inferInsert> = { updatedAt: new Date() };
  if (v.mood !== undefined) set.mood = v.mood;
  if (v.energy !== undefined) set.energy = v.energy;
  if (v.content !== undefined) set.content = v.content;
  if (v.tags !== undefined) set.tags = v.tags;
  await db
    .insert(journalEntries)
    .values({
      userId: user.id,
      date: v.date,
      mood: v.mood ?? null,
      energy: v.energy ?? null,
      content: v.content ?? "",
      tags: v.tags ?? [],
    })
    .onConflictDoUpdate({ target: [journalEntries.userId, journalEntries.date], set });
  revalidatePath("/", "layout");
}
