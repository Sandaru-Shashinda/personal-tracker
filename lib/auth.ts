import "server-only";
import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, users } from "./db";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession, type SessionPayload } from "./session";

export async function createSession(payload: SessionPayload) {
  const token = await signSession(payload);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export const getSession = cache(async () => {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
});

export const userTag = (id: string) => `user:${id}`;

/**
 * The profile fields pages need, cached in server memory per user so most requests skip a
 * database round trip (Neon is far away, so each one costs 150 ms–1 s). Changing the profile
 * must call `updateTag(userTag(id))`. The password hash is deliberately left out.
 */
async function loadProfile(id: string) {
  "use cache";
  cacheTag(userTag(id));
  cacheLife({ stale: 300, revalidate: 120, expire: 3600 });
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      timezone: users.timezone,
      weekStartsOn: users.weekStartsOn,
      currency: users.currency,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row ?? null;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof loadProfile>>>;

/** Returns the signed-in user's profile, or redirects to /login. */
export const requireUser = cache(async (): Promise<CurrentUser> => {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await loadProfile(session.sub);
  if (!user) redirect("/login");
  return user;
});

/** The stored password hash, read fresh (never cached) for password checks. */
export async function getPasswordHash(id: string) {
  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, id)).limit(1);
  return row?.hash ?? null;
}
