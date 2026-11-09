"use server";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { destroySession, getPasswordHash, requireUser, userTag } from "../auth";
import { categories, db, pushSubscriptions, users } from "../db";

type Result = { ok: true; message?: string } | { ok: false; error: string };

const profileInput = z.object({
  name: z.string().trim().min(1).max(80),
  timezone: z.string().min(1),
  weekStartsOn: z.number().int().min(0).max(1),
});

export async function updateProfile(input: z.input<typeof profileInput>): Promise<Result> {
  const user = await requireUser();
  const parsed = profileInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: parsed.data.timezone });
  } catch {
    return { ok: false, error: "Unknown timezone" };
  }
  await db.update(users).set(parsed.data).where(eq(users.id, user.id));
  updateTag(userTag(user.id));
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved" };
}

export async function changePassword(current: string, next: string): Promise<Result> {
  const user = await requireUser();
  if (next.length < 8) return { ok: false, error: "New password must be at least 8 characters" };
  const hash = await getPasswordHash(user.id);
  if (!hash || !(await bcrypt.compare(current, hash))) return { ok: false, error: "Current password is wrong" };
  await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(next, 12) })
    .where(eq(users.id, user.id));
  return { ok: true, message: "Password changed" };
}

export async function deleteAccount(password: string): Promise<Result> {
  const user = await requireUser();
  const hash = await getPasswordHash(user.id);
  if (!hash || !(await bcrypt.compare(password, hash))) return { ok: false, error: "Password is wrong" };
  await db.delete(users).where(eq(users.id, user.id));
  updateTag(userTag(user.id));
  await destroySession();
  redirect("/signup");
}

const categoryInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.string().max(40),
});

export async function saveCategory(id: string | null, input: z.input<typeof categoryInput>): Promise<Result> {
  const user = await requireUser();
  const parsed = categoryInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (id) {
    await db
      .update(categories)
      .set(parsed.data)
      .where(and(eq(categories.id, id), eq(categories.userId, user.id)));
  } else {
    await db.insert(categories).values({ ...parsed.data, userId: user.id });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteCategory(id: string) {
  const user = await requireUser();
  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, user.id)));
  revalidatePath("/", "layout");
}

const subInput = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export async function savePushSubscription(sub: unknown): Promise<Result> {
  const user = await requireUser();
  const parsed = subInput.safeParse(sub);
  if (!parsed.success) return { ok: false, error: "Invalid subscription" };
  const { endpoint, keys } = parsed.data;
  await db
    .insert(pushSubscriptions)
    .values({ userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth },
    });
  return { ok: true };
}

export async function removePushSubscription(endpoint: string) {
  const user = await requireUser();
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, user.id)));
}

export async function sendTestNotification(): Promise<Result> {
  const user = await requireUser();
  const { sendToUser, pushConfigured } = await import("../push");
  if (!pushConfigured()) return { ok: false, error: "Push isn't configured on the server (VAPID keys missing)" };
  const n = await sendToUser(user.id, {
    title: "Notifications work 🎉",
    body: "You'll get reminders for your habits and tasks here.",
    url: "/today",
  });
  return n ? { ok: true, message: `Sent to ${n} device${n === 1 ? "" : "s"}` } : { ok: false, error: "No subscribed devices" };
}
