import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { todayInTz } from "@/lib/dates";
import { getCategories, getTasks } from "@/lib/queries";
import { TasksView } from "./tasks-view";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage() {
  const user = await requireUser();
  const [tasks, categories] = await Promise.all([getTasks(user.id), getCategories(user.id)]);
  return <TasksView tasks={tasks} categories={categories} today={todayInTz(user.timezone)} />;
}
