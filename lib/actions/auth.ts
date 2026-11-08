"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession } from "../auth";
import { categories, db, users } from "../db";

export type AuthState = { error?: string; fields?: Record<string, string> } | undefined;

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  timezone: z.string().optional(),
});

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/today";
}

function validTimezone(tz: string | undefined) {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  const fields = { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const { name, email, password, timezone } = parsed.data;

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) return { error: "An account with that email already exists", fields };

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(users)
    .values({ name, email, passwordHash, timezone: validTimezone(timezone) })
    .returning();

  // Starter categories so the app isn't empty.
  await db.insert(categories).values([
    { userId: user.id, name: "Health", color: "#10b981", icon: "heart" },
    { userId: user.id, name: "Work", color: "#3b82f6", icon: "briefcase" },
    { userId: user.id, name: "Learning", color: "#f59e0b", icon: "book" },
    { userId: user.id, name: "Personal", color: "#ec4899", icon: "user" },
  ]);

  await createSession({ sub: user.id, email: user.email, name: user.name });
  redirect("/today");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  const fields = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  const ok = user && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!ok) return { error: "Invalid email or password", fields };

  await createSession({ sub: user.id, email: user.email, name: user.name });
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
