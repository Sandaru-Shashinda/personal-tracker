"use client";

import { ChevronLeft, ChevronRight, PiggyBank, Plus, Search, Target, Wallet } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast";
import { Button, Card, CardTitle, cn, Empty, Input, Label, Modal, Select, Fab } from "@/components/ui";
import { deleteExpense, saveExpense, setBudget, setCurrency } from "@/lib/actions/expenses";
import { relativeDayLabel } from "@/lib/dates";
import type { Budget, Expense } from "@/lib/db/schema";
import {
  categoryColor,
  CURRENCIES,
  EXPENSE_CATEGORIES,
  formatMoney,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
} from "@/lib/expenses";

const monthOf = (d: string) => d.slice(0, 7);
function shiftMonth(m: string, n: number) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
const monthLabel = (m: string, short = false) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-US", { month: short ? "short" : "long", year: short ? undefined : "numeric", timeZone: "UTC" });
const daysInMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
};

export function ExpensesView({
  expenses,
  budgets,
  currency,
  today,
}: {
  expenses: Expense[];
  budgets: Budget[];
  currency: string;
  today: string;
}) {
  const toast = useToast();
  const [, start] = useTransition();
  const thisMonth = monthOf(today);
  const [month, setMonth] = useState(thisMonth);
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [kind, setKind] = useState<"all" | "expense" | "income">("all");
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const money = (n: number, compact = false) => formatMoney(n, currency, { compact });

  const inMonth = expenses.filter((e) => monthOf(e.date) === month);
  const spent = inMonth.filter((e) => e.kind === "expense").reduce((s, e) => s + e.amount, 0);
  const income = inMonth.filter((e) => e.kind === "income").reduce((s, e) => s + e.amount, 0);
  const budgetMap = new Map(budgets.map((b) => [b.category, b.amount]));
  const overall = budgetMap.get("");

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of inMonth) if (e.kind === "expense") m.set(e.category, (m.get(e.category) ?? 0) + e.amount);
    return [...m.entries()].map(([name, total]) => ({ name, total, budget: budgetMap.get(name) })).sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, month, budgets]);

  const daily = useMemo(() => {
    const n = daysInMonth(month);
    const arr = Array.from({ length: n }, (_, i) => ({ day: i + 1, total: 0 }));
    for (const e of inMonth) if (e.kind === "expense") arr[Number(e.date.slice(8)) - 1].total += e.amount;
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, month]);

  const trend = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const m = shiftMonth(month, i - 5);
        const rows = expenses.filter((e) => monthOf(e.date) === m);
        return {
          label: monthLabel(m, true),
          spent: rows.filter((e) => e.kind === "expense").reduce((s, e) => s + e.amount, 0),
          income: rows.filter((e) => e.kind === "income").reduce((s, e) => s + e.amount, 0),
        };
      }),
    [expenses, month],
  );

  const text = q.toLowerCase();
  const list = inMonth.filter(
    (e) =>
      (kind === "all" || e.kind === kind) &&
      (!cat || e.category === cat) &&
      (!text || e.category.toLowerCase().includes(text) || (e.note ?? "").toLowerCase().includes(text)),
  );
  const groups = [...new Set(list.map((e) => e.date))].map((d) => ({ date: d, items: list.filter((e) => e.date === d) }));

  // Average daily spend so far this month, and a simple end-of-month projection.
  const elapsed = month === thisMonth ? Number(today.slice(8)) : daysInMonth(month);
  const projected = month === thisMonth && elapsed > 0 ? (spent / elapsed) * daysInMonth(month) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Expenses"
        sub="Track spending, income and monthly budgets"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={currency}
              onChange={(e) =>
                start(async () => {
                  const r = await setCurrency(e.target.value);
                  if (!r.ok) toast(r.error, "bad");
                })
              }
              className="w-24"
              aria-label="Currency"
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Button onClick={() => setBudgetOpen(true)}>
              <Target className="size-4" /> Budgets
            </Button>
            <Button variant="primary" onClick={() => setEditing("new")} className="max-md:hidden">
              <Plus className="size-4" /> Add
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
          <ChevronLeft className="size-4" />
        </Button>
        <h2 className="min-w-40 text-center text-lg font-semibold">{monthLabel(month)}</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMonth(shiftMonth(month, 1))}
          disabled={month >= thisMonth}
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </Button>
        {month !== thisMonth && (
          <Button variant="ghost" size="sm" onClick={() => setMonth(thisMonth)}>
            This month
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Spent" value={money(spent)} sub={projected ? `On track for ${money(projected, true)}` : `${inMonth.filter((e) => e.kind === "expense").length} expenses`} />
        <Tile label="Income" value={money(income)} sub={`${inMonth.filter((e) => e.kind === "income").length} entries`} tone="good" />
        <Tile
          label="Net"
          value={(income - spent >= 0 ? "+" : "−") + money(Math.abs(income - spent))}
          sub={income ? `${Math.round(((income - spent) / income) * 100)}% saved` : "income − spending"}
          tone={income - spent >= 0 ? "good" : "bad"}
        />
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-text-3">Budget left</p>
          {overall ? (
            <>
              <p className={cn("tabular mt-1 text-xl font-semibold tracking-tight sm:text-2xl", spent > overall && "text-bad")}>
                {spent > overall ? "−" : ""}
                {money(Math.abs(overall - spent))}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={cn("h-full rounded-full", spent > overall ? "bg-bad" : spent > overall * 0.85 ? "bg-warn" : "bg-good")}
                  style={{ width: `${Math.min(100, (spent / overall) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-text-3">of {money(overall)}</p>
            </>
          ) : (
            <button onClick={() => setBudgetOpen(true)} className="mt-1 text-sm text-accent hover:underline">
              Set a monthly budget
            </button>
          )}
        </div>
      </div>

      {expenses.length === 0 ? (
        <Empty icon={<Wallet className="size-8" />} title="No transactions yet">
          Add your first expense or income to see where your money goes.
        </Empty>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardTitle sub={`Spending per day in ${monthLabel(month, true)}`}>Daily spending</CardTitle>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daily} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--grid)" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--text-3)" }} tickLine={false} axisLine={false} interval={2} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--text-3)" }}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tickFormatter={(v) => money(Number(v), true)}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--surface-2)" }}
                      contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      labelFormatter={(d) => `${monthLabel(month, true)} ${d}`}
                      formatter={(v) => [money(Number(v)), "Spent"]}
                    />
                    <Bar dataKey="total" fill="var(--series-1)" radius={[3, 3, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <CardTitle sub="Where the money went">By category</CardTitle>
              {byCategory.length === 0 ? (
                <p className="text-sm text-text-3">No spending this month.</p>
              ) : (
                <ul className="space-y-3">
                  {byCategory.map((c) => {
                    const over = c.budget !== undefined && c.total > c.budget;
                    return (
                      <li key={c.name}>
                        <button onClick={() => setCat(cat === c.name ? "" : c.name)} className="block w-full text-left">
                          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                            <span className={cn("flex items-center gap-2 truncate", cat === c.name && "font-semibold")}>
                              <span className="size-2 shrink-0 rounded-full" style={{ background: categoryColor(c.name) }} aria-hidden />
                              {c.name}
                            </span>
                            <span className={cn("tabular shrink-0", over ? "text-bad" : "text-text-2")}>
                              {money(c.total)}
                              {c.budget !== undefined && <span className="text-text-3"> / {money(c.budget, true)}</span>}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, (c.total / (c.budget ?? byCategory[0].total)) * 100)}%`,
                                background: over ? "var(--bad)" : categoryColor(c.name),
                              }}
                            />
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          <Card>
            <CardTitle sub="Spending vs income, last 6 months">Trend</CardTitle>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--grid)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-3)" }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--text-3)" }}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(v) => money(Number(v), true)}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--surface-2)" }}
                    contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v, n) => [money(Number(v)), n === "spent" ? "Spent" : "Income"]}
                  />
                  <Bar dataKey="spent" fill="var(--series-2)" radius={[3, 3, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="income" fill="var(--good)" radius={[3, 3, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <section className="rounded-2xl border border-border bg-surface">
            <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
              <h2 className="mr-auto text-base font-semibold">Transactions</h2>
              <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5 text-sm">
                {(["all", "expense", "income"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    aria-pressed={kind === k}
                    className={cn("rounded-md px-2.5 py-1 capitalize", kind === k ? "bg-surface font-medium shadow-sm" : "text-text-2")}
                  >
                    {k === "all" ? "All" : k === "expense" ? "Spent" : "Income"}
                  </button>
                ))}
              </div>
              {cat && (
                <Button size="sm" variant="ghost" onClick={() => setCat("")}>
                  {cat} ✕
                </Button>
              )}
              <div className="relative w-full sm:w-52">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-3" aria-hidden />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-9 pl-9" aria-label="Search transactions" />
              </div>
            </div>
            {groups.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-text-3">No transactions for {monthLabel(month)}.</p>
            ) : (
              <div className="divide-y divide-border">
                {groups.map((g) => (
                  <div key={g.date}>
                    <div className="flex justify-between bg-surface-2/60 px-4 py-1.5 text-xs font-medium text-text-3">
                      <span>{relativeDayLabel(g.date, today)}</span>
                      <span className="tabular">
                        {money(g.items.filter((e) => e.kind === "expense").reduce((s, e) => s + e.amount, 0))}
                      </span>
                    </div>
                    <ul className="divide-y divide-border">
                      {g.items.map((e) => (
                        <li key={e.id}>
                          <button onClick={() => setEditing(e)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2">
                            <span
                              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                              style={{ background: categoryColor(e.category) }}
                              aria-hidden
                            >
                              {e.category.charAt(0)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{e.note || e.category}</span>
                              <span className="block truncate text-xs text-text-3">
                                {e.category}
                                {e.method ? ` · ${e.method}` : ""}
                              </span>
                            </span>
                            <span className={cn("tabular text-sm font-semibold", e.kind === "income" && "text-good")}>
                              {e.kind === "income" ? "+" : "−"}
                              {money(e.amount)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <Fab label="Add transaction" onClick={() => setEditing("new")} />
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Add transaction" : "Edit transaction"}>
        {editing && (
          <ExpenseForm
            expense={editing === "new" ? null : editing}
            defaultDate={month === thisMonth ? today : `${month}-01`}
            today={today}
            currency={currency}
            onDone={() => setEditing(null)}
            onDelete={(id) =>
              start(async () => {
                await deleteExpense(id);
                toast("Transaction deleted");
                setEditing(null);
              })
            }
          />
        )}
      </Modal>
      <Modal open={budgetOpen} onClose={() => setBudgetOpen(false)} title="Monthly budgets">
        <BudgetForm budgets={budgetMap} currency={currency} onDone={() => setBudgetOpen(false)} />
      </Modal>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs font-medium text-text-3">{label}</p>
      <p className={cn("tabular mt-1 truncate text-xl font-semibold tracking-tight sm:text-2xl", tone === "bad" && "text-bad", tone === "good" && "text-good")}>
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-text-3">{sub}</p>
    </div>
  );
}

function ExpenseForm({
  expense,
  defaultDate,
  today,
  currency,
  onDone,
  onDelete,
}: {
  expense: Expense | null;
  defaultDate: string;
  today: string;
  currency: string;
  onDone: () => void;
  onDelete: (id: string) => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<"expense" | "income">((expense?.kind as "expense" | "income") ?? "expense");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [category, setCategory] = useState(expense?.category ?? "");
  const [note, setNote] = useState(expense?.note ?? "");
  const [method, setMethod] = useState(expense?.method ?? "");
  const [date, setDate] = useState(expense?.date ?? defaultDate);
  const [error, setError] = useState<string | null>(null);
  const cats = kind === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await saveExpense(expense?.id ?? null, {
            kind,
            amount: Number(amount),
            category,
            note: note || null,
            method: method || null,
            date,
          });
          if (!res.ok) return setError(res.error);
          toast(expense ? "Transaction updated" : kind === "expense" ? "Expense added" : "Income added");
          onDone();
        });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-2 p-1">
        {(["expense", "income"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k);
              setCategory("");
            }}
            aria-pressed={kind === k}
            className={cn("rounded-md py-1.5 text-sm", kind === k ? "bg-surface font-medium shadow-sm" : "text-text-2")}
          >
            {k === "expense" ? "Expense" : "Income"}
          </button>
        ))}
      </div>
      <label className="block">
        <Label>Amount ({currency})</Label>
        <Input
          autoFocus
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className="h-12 text-lg font-semibold"
          placeholder="0.00"
        />
      </label>
      <div>
        <Label>Category</Label>
        <div className="flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => setCategory(c.name)}
              aria-pressed={category === c.name}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm",
                category === c.name ? "border-transparent text-white" : "border-border text-text-2 hover:bg-surface-2",
              )}
              style={category === c.name ? { background: c.color } : undefined}
            >
              {category !== c.name && <span className="size-2 rounded-full" style={{ background: c.color }} aria-hidden />}
              {c.name}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <Label>Date</Label>
          <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="block">
          <Label hint="optional">Paid with</Label>
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">Not set</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </label>
      </div>
      <label className="block">
        <Label hint="optional">Note</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Lunch with team" maxLength={300} />
      </label>
      {error && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
      <div className="flex items-center gap-2">
        {expense && (
          <Button
            type="button"
            variant="ghost"
            className="hover:text-bad"
            onClick={() => confirm("Delete this transaction?") && onDelete(expense.id)}
          >
            Delete
          </Button>
        )}
        <Button type="button" variant="ghost" className="ml-auto" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending || !category}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

function BudgetForm({ budgets, currency, onDone }: { budgets: Map<string, number>; currency: string; onDone: () => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(["", ...EXPENSE_CATEGORIES.map((c) => c.name)].map((k) => [k, budgets.has(k) ? String(budgets.get(k)) : ""])),
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const changed = Object.entries(values).filter(([k, v]) => (v ? Number(v) : null) !== (budgets.get(k) ?? null));
          for (const [k, v] of changed) {
            const res = await setBudget(k, v ? Number(v) : null);
            if (!res.ok) return toast(res.error, "bad");
          }
          toast("Budgets saved");
          onDone();
        });
      }}
      className="space-y-4"
    >
      <label className="block">
        <Label hint="all spending">
          <span className="flex items-center gap-1.5">
            <PiggyBank className="size-4" /> Overall monthly budget
          </span>
        </Label>
        <Input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder={`No limit (${currency})`}
          value={values[""]}
          onChange={(e) => setValues({ ...values, "": e.target.value })}
        />
      </label>
      <div>
        <p className="mb-2 text-sm font-medium text-text-2">Per category (optional)</p>
        <div className="grid max-h-[40dvh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {EXPENSE_CATEGORIES.map((c) => (
            <label key={c.name} className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
              <span className="w-28 shrink-0 truncate text-sm">{c.name}</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="–"
                value={values[c.name]}
                onChange={(e) => setValues({ ...values, [c.name]: e.target.value })}
                className="h-9"
              />
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save budgets"}
        </Button>
      </div>
    </form>
  );
}
