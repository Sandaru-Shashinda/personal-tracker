import { asc, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { todayInTz } from "@/lib/dates";
import { accountTransfers, budgets, db, debtEntries, debts, expenses, moneyAccounts } from "@/lib/db";
import { ExpensesView } from "./expenses-view";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  const user = await requireUser();
  const [rows, budgetRows, accountRows, transferRows, debtRows, entryRows] = await db.batch([
    db.select().from(expenses).where(eq(expenses.userId, user.id)).orderBy(desc(expenses.date), desc(expenses.createdAt)),
    db.select().from(budgets).where(eq(budgets.userId, user.id)),
    db.select().from(moneyAccounts).where(eq(moneyAccounts.userId, user.id)).orderBy(asc(moneyAccounts.createdAt)),
    db.select().from(accountTransfers).where(eq(accountTransfers.userId, user.id)),
    db.select().from(debts).where(eq(debts.userId, user.id)).orderBy(asc(debts.createdAt)),
    db.select().from(debtEntries).where(eq(debtEntries.userId, user.id)),
  ]);
  return (
    <ExpensesView
      expenses={rows}
      budgets={budgetRows}
      accounts={accountRows}
      transfers={transferRows}
      debts={debtRows}
      debtEntries={entryRows}
      currency={user.currency}
      today={todayInTz(user.timezone)}
    />
  );
}
