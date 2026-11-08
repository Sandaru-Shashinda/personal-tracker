import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { addDays, todayInTz } from "@/lib/dates";
import { getJournal } from "@/lib/queries";
import { JournalView } from "./journal-view";

export const metadata: Metadata = { title: "Journal" };

export default async function JournalPage({ searchParams }: PageProps<"/journal">) {
  const user = await requireUser();
  const today = todayInTz(user.timezone);
  const sp = await searchParams;
  const raw = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const date = raw > today ? today : raw;
  const entries = await getJournal(user.id, addDays(today, -730), today);
  return (
    <JournalView
      key={date}
      date={date}
      today={today}
      weekStartsOn={user.weekStartsOn}
      entries={entries.map((e) => ({ date: e.date, mood: e.mood, energy: e.energy, content: e.content, tags: e.tags }))}
    />
  );
}
