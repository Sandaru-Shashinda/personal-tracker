import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { todayInTz } from "@/lib/dates";
import { budgets, db, expenses } from "@/lib/db";
import { ExpensesView } from "./expenses-view";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  const user = await requireUser();
  const [rows, budgetRows] = await db.batch([
    db.select().from(expenses).where(eq(expenses.userId, user.id)).orderBy(desc(expenses.date), desc(expenses.createdAt)),
    db.select().from(budgets).where(eq(budgets.userId, user.id)),
  ]);
  return <ExpensesView expenses={rows} budgets={budgetRows} currency={user.currency} today={todayInTz(user.timezone)} />;
}
