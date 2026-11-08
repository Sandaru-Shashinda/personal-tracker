"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../auth";
import { db, documents, personalProfiles } from "../db";
import { DOCUMENT_CATEGORIES, profileSchema, type Profile } from "../personal";

type Result = { ok: true } | { ok: false; error: string };

export async function saveProfile(input: Profile): Promise<Result> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  await db
    .insert(personalProfiles)
    .values({ userId: user.id, data: parsed.data, updatedAt: new Date() })
    .onConflictDoUpdate({ target: personalProfiles.userId, set: { data: parsed.data, updatedAt: new Date() } });
  revalidatePath("/personal");
  return { ok: true };
}

const docMeta = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  category: z.enum(DOCUMENT_CATEGORIES as [string, ...string[]]),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  notes: z.string().trim().max(1000).nullable(),
});

export async function updateDocument(id: string, input: z.input<typeof docMeta>): Promise<Result> {
  const user = await requireUser();
  const parsed = docMeta.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  await db
    .update(documents)
    .set(parsed.data)
    .where(and(eq(documents.id, id), eq(documents.userId, user.id)));
  revalidatePath("/personal");
  return { ok: true };
}

export async function deleteDocument(id: string) {
  const user = await requireUser();
  await db.delete(documents).where(and(eq(documents.id, id), eq(documents.userId, user.id)));
  revalidatePath("/personal");
}
