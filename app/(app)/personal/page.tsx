import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { todayInTz } from "@/lib/dates";
import { db, documents, personalProfiles } from "@/lib/db";
import { parseProfile } from "@/lib/personal";
import { PersonalView } from "./personal-view";

export const metadata: Metadata = { title: "Personal" };

export default async function PersonalPage() {
  const user = await requireUser();
  const [[profile], docs] = await Promise.all([
    db.select().from(personalProfiles).where(eq(personalProfiles.userId, user.id)).limit(1),
    db
      .select({
        id: documents.id,
        name: documents.name,
        category: documents.category,
        fileName: documents.fileName,
        mimeType: documents.mimeType,
        size: documents.size,
        expiryDate: documents.expiryDate,
        notes: documents.notes,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(eq(documents.userId, user.id))
      .orderBy(desc(documents.createdAt)),
  ]);

  return (
    <PersonalView
      profile={parseProfile(profile?.data)}
      updatedAt={profile?.updatedAt ?? null}
      documents={docs}
      today={todayInTz(user.timezone)}
    />
  );
}
