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
