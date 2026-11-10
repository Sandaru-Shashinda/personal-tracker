// Client-safe expense constants and formatting.

export const EXPENSE_CATEGORIES = [
  { name: "Food & dining", color: "#eb6834" },
  { name: "Groceries", color: "#1baf7a" },
  { name: "Transport", color: "#2a78d6" },
  { name: "Bills & utilities", color: "#6250d6" },
  { name: "Rent & housing", color: "#a16207" },
  { name: "Shopping", color: "#e87ba4" },
  { name: "Health", color: "#e34948" },
  { name: "Entertainment", color: "#eda100" },
  { name: "Education", color: "#0ea5e9" },
  { name: "Travel", color: "#14b8a6" },
  { name: "Gifts & donations", color: "#7c3aed" },
  { name: "Personal care", color: "#db2777" },
  { name: "Other", color: "#64748b" },
];

export const INCOME_CATEGORIES = [
  { name: "Salary", color: "#1a8a4a" },
  { name: "Freelance", color: "#0ea5e9" },
  { name: "Business", color: "#2a78d6" },
  { name: "Investments", color: "#6250d6" },
  { name: "Gift", color: "#e87ba4" },
  { name: "Other income", color: "#64748b" },
];

export const PAYMENT_METHODS = ["Cash", "Card", "Bank transfer", "Mobile wallet", "Other"];

export const CURRENCIES = ["LKR", "USD", "EUR", "GBP", "INR", "AUD", "CAD", "SGD", "AED", "JPY"];

const CATEGORY_COLOR = new Map([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map((c) => [c.name, c.color]));
export const categoryColor = (name: string) => CATEGORY_COLOR.get(name) ?? "#64748b";

export function formatMoney(amount: number, currency: string, opts: { compact?: boolean } = {}) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: opts.compact ? "compact" : "standard",
      maximumFractionDigits: opts.compact ? 1 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// --- Accounts, transfers, lending & borrowing ------------------------------------------------

export const ACCOUNT_TYPES = [
  { id: "cash", label: "Cash", color: "#1baf7a" },
  { id: "bank", label: "Bank account", color: "#2a78d6" },
  { id: "savings", label: "Savings", color: "#6250d6" },
  { id: "wallet", label: "Mobile wallet", color: "#0ea5e9" },
  { id: "investment", label: "Investment", color: "#a16207" },
  { id: "other", label: "Other", color: "#64748b" },
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number]["id"];
export const accountTypeOf = (id: string) => ACCOUNT_TYPES.find((t) => t.id === id) ?? ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1];

export type DebtDirection = "lent" | "borrowed";
export type DebtEntryKind = "add" | "repay";

/**
 * How a debt entry moves cash in the linked account: lending or repaying a debt takes money out,
 * borrowing or being repaid brings it in.
 */
export function debtCashFlow(direction: string, kind: string, amount: number) {
  const inflow = (direction === "borrowed") === (kind === "add");
  return inflow ? amount : -amount;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

type Flowish = { accountId: string | null; amount: number };

/** Net change per account from its linked transactions, debt entries and transfers. */
export function accountFlows(input: {
  expenses: (Flowish & { kind: string })[];
  debtEntries: (Flowish & { debtId: string; kind: string })[];
  debts: { id: string; direction: string }[];
  transfers: { fromAccountId: string | null; toAccountId: string | null; amount: number }[];
}) {
  const flow = new Map<string, number>();
  const add = (id: string | null, n: number) => id && flow.set(id, (flow.get(id) ?? 0) + n);
  for (const e of input.expenses) add(e.accountId, e.kind === "income" ? e.amount : -e.amount);
  const dir = new Map(input.debts.map((d) => [d.id, d.direction]));
  for (const e of input.debtEntries) add(e.accountId, debtCashFlow(dir.get(e.debtId) ?? "lent", e.kind, e.amount));
  for (const t of input.transfers) {
    add(t.fromAccountId, -t.amount);
    add(t.toAccountId, t.amount);
  }
  for (const [k, v] of flow) flow.set(k, round2(v));
  return flow;
}

/** Outstanding amount per debt: everything added minus everything repaid. */
export function debtBalances(entries: { debtId: string; kind: string; amount: number }[]) {
  const out = new Map<string, number>();
  for (const e of entries) out.set(e.debtId, round2((out.get(e.debtId) ?? 0) + (e.kind === "repay" ? -e.amount : e.amount)));
  return out;
}
