import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { db, notes } from "@/lib/db";
import { NotesView } from "./notes-view";

export const metadata: Metadata = { title: "Notes" };

export default async function NotesPage() {
  const user = await requireUser();
  const rows = await db.select().from(notes).where(eq(notes.userId, user.id)).orderBy(desc(notes.updatedAt));
  return <NotesView notes={rows} />;
}
