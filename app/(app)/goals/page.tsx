import { asc, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { todayInTz } from "@/lib/dates";
import { db, goalMilestones, goals } from "@/lib/db";
import { GoalsView } from "./goals-view";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage() {
  const user = await requireUser();
  const [goalRows, milestones] = await Promise.all([
    db.select().from(goals).where(eq(goals.userId, user.id)).orderBy(desc(goals.createdAt)),
    db.select().from(goalMilestones).where(eq(goalMilestones.userId, user.id)).orderBy(asc(goalMilestones.createdAt)),
  ]);
  return <GoalsView goals={goalRows} milestones={milestones} today={todayInTz(user.timezone)} />;
}
