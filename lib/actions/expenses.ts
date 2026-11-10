"use server";

import { and, eq, inArray, or, sql } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireUser, userTag } from "../auth";
import { accountTransfers, budgets, db, debtEntries, debts, expenses, moneyAccounts, users } from "../db";
import { ACCOUNT_TYPES, CURRENCIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from "../expenses";

type Result = { ok: true } | { ok: false; error: string };

const expenseInput = z
  .object({
    kind: z.enum(["expense", "income"]),
    amount: z.number().positive("Amount must be more than 0").max(1_000_000_000_000),
    category: z.string().min(1),
    note: z.string().trim().max(300).nullable(),
    method: z.enum(PAYMENT_METHODS as [string, ...string[]]).nullable(),
    accountId: z.uuid().nullable().default(null),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  })
  .refine(
    (v) => (v.kind === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).some((c) => c.name === v.category),
    { message: "Pick a category" },
  );

function refresh() {
  revalidatePath("/expenses");
  revalidatePath("/today");
}

export async function saveExpense(id: string | null, input: z.input<typeof expenseInput>): Promise<Result> {
  const user = await requireUser();
  const parsed = expenseInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = { ...parsed.data, amount: round2(parsed.data.amount) };
  const refError = await checkRefs(user.id, [v.accountId]);
  if (refError) return { ok: false, error: refError };
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
  updateTag(userTag(user.id));
  refresh();
  return { ok: true };
}

// --- Accounts, transfers, lending & borrowing ------------------------------------------------

const round2 = (n: number) => Math.round(n * 100) / 100;
const amountSchema = z.number().positive("Amount must be more than 0").max(1_000_000_000_000);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const noteSchema = z.string().trim().max(300).nullable();
const NO_ID = "00000000-0000-0000-0000-000000000000";

/** Make sure every referenced account (and debt) belongs to this user. One round trip. */
async function checkRefs(userId: string, accountIds: (string | null)[], debtId?: string): Promise<string | null> {
  const ids = [...new Set(accountIds.filter((x): x is string => !!x))];
  if (!ids.length && !debtId) return null;
  const [accs, ds] = await db.batch([
    db
      .select({ id: moneyAccounts.id })
      .from(moneyAccounts)
      .where(and(eq(moneyAccounts.userId, userId), inArray(moneyAccounts.id, ids.length ? ids : [NO_ID]))),
    db
      .select({ id: debts.id })
      .from(debts)
      .where(and(eq(debts.userId, userId), eq(debts.id, debtId ?? NO_ID))),
  ]);
  if (accs.length !== ids.length) return "That account no longer exists";
  if (debtId && !ds.length) return "That record no longer exists";
  return null;
}

const accountInput = z.object({
  name: z.string().trim().min(1, "Give the account a name").max(60),
  type: z.enum(ACCOUNT_TYPES.map((t) => t.id) as [string, ...string[]]),
  /** The balance right now. For an existing account the opening balance is back-calculated. */
  balance: z.number().min(-1_000_000_000_000).max(1_000_000_000_000),
});

export async function saveAccount(id: string | null, input: z.input<typeof accountInput>): Promise<Result> {
  const user = await requireUser();
  const parsed = accountInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { name, type } = parsed.data;
  const balance = round2(parsed.data.balance);
  if (!id) {
    await db.insert(moneyAccounts).values({ userId: user.id, name, type, openingBalance: balance });
    refresh();
    return { ok: true };
  }
  // Opening balance = wanted balance − everything that has flowed through the account so far.
  const [acc, exp, debt, xfer] = await db.batch([
    db.select({ id: moneyAccounts.id }).from(moneyAccounts).where(and(eq(moneyAccounts.id, id), eq(moneyAccounts.userId, user.id))),
    db
      .select({
        n: sql<number>`coalesce(sum(case when ${expenses.kind} = 'income' then ${expenses.amount} else -${expenses.amount} end), 0)`.mapWith(Number),
      })
      .from(expenses)
      .where(and(eq(expenses.userId, user.id), eq(expenses.accountId, id))),
    db
      .select({
        n: sql<number>`coalesce(sum(case when (${debts.direction} = 'borrowed') = (${debtEntries.kind} = 'add') then ${debtEntries.amount} else -${debtEntries.amount} end), 0)`.mapWith(
          Number,
        ),
      })
      .from(debtEntries)
      .innerJoin(debts, eq(debts.id, debtEntries.debtId))
      .where(and(eq(debtEntries.userId, user.id), eq(debtEntries.accountId, id))),
    db
      .select({
        n: sql<number>`coalesce(sum(case when ${accountTransfers.toAccountId} = ${id} then ${accountTransfers.amount} else -${accountTransfers.amount} end), 0)`.mapWith(
          Number,
        ),
      })
      .from(accountTransfers)
      .where(and(eq(accountTransfers.userId, user.id), or(eq(accountTransfers.fromAccountId, id), eq(accountTransfers.toAccountId, id)))),
  ]);
  if (!acc.length) return { ok: false, error: "That account no longer exists" };
  const flow = (exp[0]?.n ?? 0) + (debt[0]?.n ?? 0) + (xfer[0]?.n ?? 0);
  await db
    .update(moneyAccounts)
    .set({ name, type, openingBalance: round2(balance - flow) })
    .where(and(eq(moneyAccounts.id, id), eq(moneyAccounts.userId, user.id)));
  refresh();
  return { ok: true };
}

export async function setAccountArchived(id: string, archived: boolean) {
  const user = await requireUser();
  await db.update(moneyAccounts).set({ archived }).where(and(eq(moneyAccounts.id, id), eq(moneyAccounts.userId, user.id)));
  refresh();
}

/** Linked transactions, transfers and debt entries are kept; they just stop pointing at an account. */
export async function deleteAccount(id: string) {
  const user = await requireUser();
  await db.delete(moneyAccounts).where(and(eq(moneyAccounts.id, id), eq(moneyAccounts.userId, user.id)));
  refresh();
}

const transferInput = z
  .object({
    fromAccountId: z.uuid("Pick an account"),
    toAccountId: z.uuid("Pick an account"),
    amount: amountSchema,
    date: dateSchema,
    note: noteSchema,
  })
  .refine((v) => v.fromAccountId !== v.toAccountId, { message: "Pick two different accounts" });

export async function saveTransfer(id: string | null, input: z.input<typeof transferInput>): Promise<Result> {
  const user = await requireUser();
  const parsed = transferInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = { ...parsed.data, amount: round2(parsed.data.amount) };
  const refError = await checkRefs(user.id, [v.fromAccountId, v.toAccountId]);
  if (refError) return { ok: false, error: refError };
  if (id) {
    await db.update(accountTransfers).set(v).where(and(eq(accountTransfers.id, id), eq(accountTransfers.userId, user.id)));
  } else {
    await db.insert(accountTransfers).values({ ...v, userId: user.id });
  }
  refresh();
  return { ok: true };
}

export async function deleteTransfer(id: string) {
  const user = await requireUser();
  await db.delete(accountTransfers).where(and(eq(accountTransfers.id, id), eq(accountTransfers.userId, user.id)));
  refresh();
}

const entryInput = z.object({
  kind: z.enum(["add", "repay"]),
  amount: amountSchema,
  date: dateSchema,
  /** null = no cash moved through a tracked account (e.g. a debt that already existed). */
  accountId: z.uuid().nullable(),
  note: noteSchema,
});

const debtInput = z.object({
  person: z.string().trim().min(1, "Who is it with?").max(80),
  direction: z.enum(["lent", "borrowed"]),
  note: noteSchema,
  dueDate: dateSchema.nullable(),
});

/** Create a debt together with its first amount, or edit its details (person, note, due date). */
export async function saveDebt(
  id: string | null,
  input: z.input<typeof debtInput>,
  first?: Omit<z.input<typeof entryInput>, "kind">,
): Promise<Result> {
  const user = await requireUser();
  const parsed = debtInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (id) {
    const { person, note, dueDate } = parsed.data;
    await db.update(debts).set({ person, note, dueDate }).where(and(eq(debts.id, id), eq(debts.userId, user.id)));
    refresh();
    return { ok: true };
  }
  const entry = entryInput.safeParse({ ...first, kind: "add" });
  if (!entry.success) return { ok: false, error: entry.error.issues[0].message };
  const refError = await checkRefs(user.id, [entry.data.accountId]);
  if (refError) return { ok: false, error: refError };
  const debtId = crypto.randomUUID();
  await db.batch([
    db.insert(debts).values({ id: debtId, userId: user.id, ...parsed.data }),
    db.insert(debtEntries).values({ ...entry.data, amount: round2(entry.data.amount), debtId, userId: user.id }),
  ]);
  refresh();
  return { ok: true };
}

export async function deleteDebt(id: string) {
  const user = await requireUser();
  await db.delete(debts).where(and(eq(debts.id, id), eq(debts.userId, user.id)));
  refresh();
}

/** Record a repayment, or lending/borrowing more, against an existing debt. */
export async function saveDebtEntry(id: string | null, debtId: string, input: z.input<typeof entryInput>): Promise<Result> {
  const user = await requireUser();
  const parsed = entryInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = { ...parsed.data, amount: round2(parsed.data.amount) };
  const refError = await checkRefs(user.id, [v.accountId], debtId);
  if (refError) return { ok: false, error: refError };
  if (id) {
    await db
      .update(debtEntries)
      .set(v)
      .where(and(eq(debtEntries.id, id), eq(debtEntries.userId, user.id), eq(debtEntries.debtId, debtId)));
  } else {
    await db.insert(debtEntries).values({ ...v, debtId, userId: user.id });
  }
  refresh();
  return { ok: true };
}

export async function deleteDebtEntry(id: string) {
  const user = await requireUser();
  await db.delete(debtEntries).where(and(eq(debtEntries.id, id), eq(debtEntries.userId, user.id)));
  refresh();
}
