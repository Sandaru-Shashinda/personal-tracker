"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../auth";
import { budgets, db, expenses, users } from "../db";
import { CURRENCIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from "../expenses";

type Result = { ok: true } | { ok: false; error: string };

const expenseInput = z
  .object({
    kind: z.enum(["expense", "income"]),
    amount: z.number().positive("Amount must be more than 0").max(1_000_000_000_000),
    category: z.string().min(1),
    note: z.string().trim().max(300).nullable(),
    method: z.enum(PAYMENT_METHODS as [string, ...string[]]).nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  })
  .refine(
    (v) => (v.kind === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).some((c) => c.name === v.category),
    { message: "Pick a category" },
  );

function refresh() {
  revalidatePath("/expenses");
}

export async function saveExpense(id: string | null, input: z.input<typeof expenseInput>): Promise<Result> {
  const user = await requireUser();
  const parsed = expenseInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = { ...parsed.data, amount: Math.round(parsed.data.amount * 100) / 100 };
  if (id) {
    await db
      .update(expenses)
      .set(v)
      .where(and(eq(expenses.id, id), eq(expenses.userId, user.id)));
  } else {
    await db.insert(expenses).values({ ...v, userId: user.id });
  }
  refresh();
  return { ok: true };
}

export async function deleteExpense(id: string) {
  const user = await requireUser();
  await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, user.id)));
  refresh();
}

/** Set a monthly budget. category "" is the overall budget; amount null removes it. */
export async function setBudget(category: string, amount: number | null): Promise<Result> {
  const user = await requireUser();
  if (category !== "" && !EXPENSE_CATEGORIES.some((c) => c.name === category)) return { ok: false, error: "Unknown category" };
  if (amount === null || amount <= 0) {
    await db.delete(budgets).where(and(eq(budgets.userId, user.id), eq(budgets.category, category)));
  } else {
    if (!Number.isFinite(amount) || amount > 1_000_000_000_000) return { ok: false, error: "Invalid amount" };
    await db
      .insert(budgets)
      .values({ userId: user.id, category, amount })
      .onConflictDoUpdate({ target: [budgets.userId, budgets.category], set: { amount } });
  }
  refresh();
  return { ok: true };
}

export async function setCurrency(currency: string): Promise<Result> {
  const user = await requireUser();
  if (!CURRENCIES.includes(currency)) return { ok: false, error: "Unsupported currency" };
  await db.update(users).set({ currency }).where(eq(users.id, user.id));
  refresh();
  return { ok: true };
}
