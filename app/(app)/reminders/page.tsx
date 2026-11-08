import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { todayInTz } from "@/lib/dates";
import { db, reminders } from "@/lib/db";
import { RemindersView } from "./reminders-view";

export const metadata: Metadata = { title: "Reminders" };

export default async function RemindersPage({ searchParams }: PageProps<"/reminders">) {
  const user = await requireUser();
  const sp = await searchParams;
  // ?date=YYYY-MM-DD (e.g. from a notification) opens the calendar on that day.
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null;
  const rows = await db
    .select()
    .from(reminders)
    .where(eq(reminders.userId, user.id))
    .orderBy(asc(reminders.date), asc(reminders.time));
  return (
    <RemindersView
      key={date ?? "list"}
      reminders={rows}
      today={todayInTz(user.timezone)}
      weekStartsOn={user.weekStartsOn}
      initialDate={date}
    />
  );
}
