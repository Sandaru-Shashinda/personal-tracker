import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { db, todoItems, todoLists } from "@/lib/db";
import { TodoView } from "./todo-view";

export const metadata: Metadata = { title: "To-do" };

export default async function TodoPage() {
  const user = await requireUser();
  const [lists, items] = await db.batch([
    db.select().from(todoLists).where(eq(todoLists.userId, user.id)).orderBy(asc(todoLists.createdAt)),
    db.select().from(todoItems).where(eq(todoItems.userId, user.id)).orderBy(asc(todoItems.createdAt)),
  ]);
  return <TodoView lists={lists} items={items} />;
}
