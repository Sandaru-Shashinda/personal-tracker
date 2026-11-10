"use client";

import {
  ArrowLeftRight,
  Banknote,
  CalendarClock,
  ChevronDown,
  HandCoins,
  Landmark,
  PiggyBank,
  Plus,
  Scale,
  Smartphone,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { Button, Card, CardTitle, cn, Fab, Input, Label, Modal, Select } from "@/components/ui";
import {
  deleteAccount,
  deleteDebt,
  deleteDebtEntry,
  deleteTransfer,
  saveAccount,
  saveDebt,
  saveDebtEntry,
  saveTransfer,
  setAccountArchived,
} from "@/lib/actions/expenses";
import { diffDays, prettyDay, relativeDayLabel } from "@/lib/dates";
import type { AccountTransfer, Debt, DebtEntry, Expense, MoneyAccount } from "@/lib/db/schema";
import {
  ACCOUNT_TYPES,
  accountFlows,
  accountTypeOf,
  debtBalances,
  debtCashFlow,
  formatMoney,
  type DebtDirection,
} from "@/lib/expenses";

const round2 = (n: number) => Math.round(n * 100) / 100;
const isZero = (n: number) => Math.abs(n) < 0.005;
const TYPE_ICON: Record<string, typeof Wallet> = {
  cash: Banknote,
  bank: Landmark,
  savings: PiggyBank,
  wallet: Smartphone,
  investment: TrendingUp,
  other: Wallet,
};

type Dialog =
  | { t: "menu" }
  | { t: "account"; account: MoneyAccount | null; back?: Dialog }
  | { t: "accountView"; id: string }
  | { t: "transfer"; transfer: AccountTransfer | null; fromId?: string; back?: Dialog }
  | { t: "debt"; debt: Debt | null; direction: DebtDirection; accountId: string | null; back?: Dialog }
  | { t: "debtView"; id: string }
  | { t: "entry"; debtId: string; entry: DebtEntry | null; kind: "add" | "repay"; back?: Dialog };

type Activity = {
  key: string;
  date: string;
  createdAt: number;
  title: string;
  sub: string;
  amount: number;
  open?: () => void;
};

export function BalancesView({
  accounts,
  transfers,
  debts,
  debtEntries,
  expenses,
  currency,
  today,
  defaultAccountId,
}: {
  accounts: MoneyAccount[];
  transfers: AccountTransfer[];
  debts: Debt[];
  debtEntries: DebtEntry[];
  expenses: Expense[];
  currency: string;
  today: string;
  defaultAccountId: string | null;
}) {
  const toast = useToast();
  const [, start] = useTransition();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const money = (n: number, compact = false) => formatMoney(n, currency, { compact });
  const close = () => setDialog(null);

  const flows = useMemo(() => accountFlows({ expenses, debtEntries, debts, transfers }), [expenses, debtEntries, debts, transfers]);
  const outstanding = useMemo(() => debtBalances(debtEntries), [debtEntries]);
  const balanceOf = (a: MoneyAccount) => round2(a.openingBalance + (flows.get(a.id) ?? 0));
  const accountName = (id: string | null) => (id ? (accounts.find((a) => a.id === id)?.name ?? "Deleted account") : "No account");
  const debtById = new Map(debts.map((d) => [d.id, d]));

  const activeAccounts = accounts.filter((a) => !a.archived);
  const archivedAccounts = accounts.filter((a) => a.archived);
  const inAccounts = round2(accounts.reduce((s, a) => s + balanceOf(a), 0));
  let owedToMe = 0;
  let iOwe = 0;
  for (const d of debts) {
    const o = outstanding.get(d.id) ?? 0;
    const net = d.direction === "lent" ? o : -o;
    if (net > 0) owedToMe += net;
    else iOwe -= net;
  }
  const netWorth = round2(inAccounts + owedToMe - iOwe);

  const debtStats = (id: string) => {
    let added = 0;
    let repaid = 0;
    for (const e of debtEntries) {
      if (e.debtId !== id) continue;
      if (e.kind === "repay") repaid += e.amount;
      else added += e.amount;
    }
    return { added: round2(added), repaid: round2(repaid), left: outstanding.get(id) ?? 0 };
  };

  function activityFor(accountId: string, back: Dialog): Activity[] {
    const items: Activity[] = [];
    for (const e of expenses)
      if (e.accountId === accountId)
        items.push({
          key: `e${e.id}`,
          date: e.date,
          createdAt: new Date(e.createdAt).getTime(),
          title: e.note || e.category,
          sub: e.category,
          amount: e.kind === "income" ? e.amount : -e.amount,
        });
    for (const e of debtEntries) {
      const d = debtById.get(e.debtId);
      if (e.accountId !== accountId || !d) continue;
      const lent = d.direction === "lent";
      items.push({
        key: `d${e.id}`,
        date: e.date,
        createdAt: new Date(e.createdAt).getTime(),
        title: `${e.kind === "add" ? (lent ? "Lent to" : "Borrowed from") : lent ? "Paid back by" : "Paid back to"} ${d.person}`,
        sub: lent ? "Lending" : "Borrowing",
        amount: debtCashFlow(d.direction, e.kind, e.amount),
        open: () => setDialog({ t: "entry", debtId: d.id, entry: e, kind: e.kind as "add" | "repay", back }),
      });
    }
    for (const t of transfers) {
      if (t.fromAccountId !== accountId && t.toAccountId !== accountId) continue;
      const out = t.fromAccountId === accountId;
      items.push({
        key: `t${t.id}`,
        date: t.date,
        createdAt: new Date(t.createdAt).getTime(),
        title: out ? `To ${accountName(t.toAccountId)}` : `From ${accountName(t.fromAccountId)}`,
        sub: t.note ? `Transfer · ${t.note}` : "Transfer",
        amount: out ? -t.amount : t.amount,
        open: () => setDialog({ t: "transfer", transfer: t, back }),
      });
    }
    return items.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }

  const empty = accounts.length === 0 && debts.length === 0;
  const viewedAccount = dialog?.t === "accountView" ? accounts.find((a) => a.id === dialog.id) : undefined;
  const viewedDebt = dialog?.t === "debtView" ? debtById.get(dialog.id) : undefined;
  const entryDebt = dialog?.t === "entry" ? debtById.get(dialog.debtId) : undefined;

  const title = (() => {
    switch (dialog?.t) {
      case "menu":
        return "Add";
      case "account":
        return dialog.account ? "Edit account" : "Add account";
      case "accountView":
        return viewedAccount?.name ?? "Account";
      case "transfer":
        return dialog.transfer ? "Edit transfer" : "Move money";
      case "debt":
        return dialog.debt ? "Edit details" : dialog.direction === "lent" ? "Someone owes me" : "I owe someone";
      case "debtView":
        return viewedDebt?.person ?? "";
      case "entry":
        return dialog.entry ? "Edit entry" : dialog.kind === "repay" ? "Record a repayment" : entryDebt?.direction === "lent" ? "Lend more" : "Borrow more";
      default:
        return "";
    }
  })();

  return (
    <div className="space-y-5">
      {empty ? (
        <Card>
          <CardTitle sub="Add today's numbers once. After that, they update as you record transactions, loans and repayments.">
            Start with what you have today
          </CardTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            <SetupButton
              icon={<PiggyBank className="size-5" />}
              title="Savings & accounts"
              sub="Cash, bank, savings: what's in each right now"
              onClick={() => setDialog({ t: "account", account: null })}
            />
            <SetupButton
              icon={<HandCoins className="size-5" />}
              title="People who owe me"
              sub="Money you've lent that isn't back yet"
              onClick={() => setDialog({ t: "debt", debt: null, direction: "lent", accountId: null })}
            />
            <SetupButton
              icon={<Scale className="size-5" />}
              title="Money I owe"
              sub="Loans and debts you still have to repay"
              onClick={() => setDialog({ t: "debt", debt: null, direction: "borrowed", accountId: null })}
            />
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile
            label="Net worth"
            value={(netWorth < 0 ? "−" : "") + money(Math.abs(netWorth))}
            sub="accounts + owed to you − you owe"
            tone={netWorth < 0 ? "bad" : undefined}
          />
          <Tile label="In accounts" value={(inAccounts < 0 ? "−" : "") + money(Math.abs(inAccounts))} sub={`${activeAccounts.length} account${activeAccounts.length === 1 ? "" : "s"}`} />
          <Tile label="Owed to you" value={money(owedToMe)} sub="money you lent" tone="good" />
          <Tile label="You owe" value={money(iOwe)} sub="money you borrowed" tone={iOwe > 0 ? "bad" : undefined} />
        </div>
      )}

      <Card>
        <CardTitle
          sub="Linked transactions, loans and transfers update these balances"
          action={
            <div className="flex gap-2">
              {activeAccounts.length >= 2 && (
                <Button size="sm" onClick={() => setDialog({ t: "transfer", transfer: null })}>
                  <ArrowLeftRight className="size-4" /> <span className="max-sm:hidden">Move money</span>
                </Button>
              )}
              <Button size="sm" onClick={() => setDialog({ t: "account", account: null })}>
                <Plus className="size-4" /> Account
              </Button>
            </div>
          }
        >
          Accounts
        </CardTitle>
        {activeAccounts.length === 0 ? (
          <p className="text-sm text-text-3">
            No accounts yet. Add your cash, bank and savings with what&apos;s in them today.
          </p>
        ) : (
          <ul className="-mx-2 divide-y divide-border">
            {activeAccounts.map((a) => (
              <AccountRow key={a.id} account={a} balance={balanceOf(a)} money={money} onClick={() => setDialog({ t: "accountView", id: a.id })} />
            ))}
          </ul>
        )}
        {archivedAccounts.length > 0 && (
          <div className="mt-3">
            <button onClick={() => setShowArchived(!showArchived)} className="flex items-center gap-1 text-xs font-medium text-text-3 hover:text-text-2">
              <ChevronDown className={cn("size-3.5 transition-transform", showArchived && "rotate-180")} /> Archived ({archivedAccounts.length})
            </button>
            {showArchived && (
              <ul className="-mx-2 mt-1 divide-y divide-border opacity-70">
                {archivedAccounts.map((a) => (
                  <AccountRow key={a.id} account={a} balance={balanceOf(a)} money={money} onClick={() => setDialog({ t: "accountView", id: a.id })} />
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {(["lent", "borrowed"] as const).map((direction) => (
          <DebtList
            key={direction}
            direction={direction}
            debts={debts.filter((d) => d.direction === direction)}
            stats={debtStats}
            total={direction === "lent" ? owedToMe : iOwe}
            today={today}
            money={money}
            onAdd={() => setDialog({ t: "debt", debt: null, direction, accountId: defaultAccountId })}
            onOpen={(id) => setDialog({ t: "debtView", id })}
          />
        ))}
      </div>

      <Fab label="Add account, loan or debt" onClick={() => setDialog({ t: "menu" })} />

      <Modal open={!!dialog} onClose={close} title={title}>
        {dialog?.t === "menu" && (
          <div className="grid gap-2 pb-1">
            <MenuItem icon={<Landmark className="size-5" />} title="Add account" sub="Cash, bank, savings…" onClick={() => setDialog({ t: "account", account: null })} />
            {activeAccounts.length >= 2 && (
              <MenuItem
                icon={<ArrowLeftRight className="size-5" />}
                title="Move money"
                sub="e.g. from your bank into savings"
                onClick={() => setDialog({ t: "transfer", transfer: null })}
              />
            )}
            <MenuItem
              icon={<HandCoins className="size-5" />}
              title="Lend money"
              sub="Or record someone who already owes you"
              onClick={() => setDialog({ t: "debt", debt: null, direction: "lent", accountId: defaultAccountId })}
            />
            <MenuItem
              icon={<Scale className="size-5" />}
              title="Borrow money"
              sub="Or record a debt you already have"
              onClick={() => setDialog({ t: "debt", debt: null, direction: "borrowed", accountId: defaultAccountId })}
            />
          </div>
        )}

        {dialog?.t === "account" && (
          <AccountForm
            account={dialog.account}
            balance={dialog.account ? balanceOf(dialog.account) : 0}
            currency={currency}
            onDone={() => setDialog(dialog.back ?? null)}
            onArchive={(a) =>
              start(async () => {
                await setAccountArchived(a.id, !a.archived);
                toast(a.archived ? "Account restored" : "Account archived");
                close();
              })
            }
            onDelete={(a) =>
              start(async () => {
                await deleteAccount(a.id);
                toast("Account deleted");
                close();
              })
            }
          />
        )}

        {dialog?.t === "accountView" && viewedAccount && (
          <AccountDetail
            account={viewedAccount}
            balance={balanceOf(viewedAccount)}
            activity={activityFor(viewedAccount.id, dialog)}
            canTransfer={activeAccounts.length >= 2 && !viewedAccount.archived}
            today={today}
            money={money}
            onEdit={() => setDialog({ t: "account", account: viewedAccount, back: dialog })}
            onTransfer={() => setDialog({ t: "transfer", transfer: null, fromId: viewedAccount.id, back: dialog })}
          />
        )}

        {dialog?.t === "transfer" && (
          <TransferForm
            transfer={dialog.transfer}
            fromId={dialog.fromId}
            accounts={accounts}
            today={today}
            currency={currency}
            onDone={() => setDialog(dialog.back ?? null)}
            onDelete={(id) =>
              start(async () => {
                await deleteTransfer(id);
                toast("Transfer deleted");
                setDialog(dialog.back ?? null);
              })
            }
          />
        )}

        {dialog?.t === "debt" && (
          <DebtForm
            debt={dialog.debt}
            initialDirection={dialog.direction}
            initialAccountId={dialog.accountId}
            debts={debts}
            outstanding={outstanding}
            accounts={accounts}
            today={today}
            currency={currency}
            onDone={() => setDialog(dialog.back ?? null)}
            onUseExisting={(d) => setDialog({ t: "entry", debtId: d.id, entry: null, kind: "add", back: { t: "debtView", id: d.id } })}
          />
        )}

        {dialog?.t === "debtView" && viewedDebt && (
          <DebtDetail
            debt={viewedDebt}
            stats={debtStats(viewedDebt.id)}
            entries={debtEntries.filter((e) => e.debtId === viewedDebt.id)}
            accountName={accountName}
            today={today}
            money={money}
            onEntry={(entry, kind) => setDialog({ t: "entry", debtId: viewedDebt.id, entry, kind, back: dialog })}
            onEdit={() => setDialog({ t: "debt", debt: viewedDebt, direction: viewedDebt.direction as DebtDirection, accountId: null, back: dialog })}
            onDelete={() =>
              start(async () => {
                await deleteDebt(viewedDebt.id);
                toast("Deleted");
                close();
              })
            }
          />
        )}

        {dialog?.t === "entry" && entryDebt && (
          <EntryForm
            debt={entryDebt}
            entry={dialog.entry}
            initialKind={dialog.kind}
            outstanding={outstanding.get(entryDebt.id) ?? 0}
            accounts={accounts}
            defaultAccountId={defaultAccountId}
            today={today}
            currency={currency}
            onDone={() => setDialog(dialog.back ?? null)}
            onDelete={(id) =>
              start(async () => {
                await deleteDebtEntry(id);
                toast("Entry deleted");
                setDialog(dialog.back ?? null);
              })
            }
          />
        )}
      </Modal>
    </div>
  );
}

// --- Pieces --------------------------------------------------------------------------------------

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <p className="text-xs font-medium text-text-3">{label}</p>
      <p className={cn("tabular mt-1 truncate text-xl font-semibold tracking-tight sm:text-2xl", tone === "bad" && "text-bad", tone === "good" && "text-good")}>
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-text-3">{sub}</p>
    </div>
  );
}

function SetupButton({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-start gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-accent hover:bg-surface-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-text-3">{sub}</span>
      </span>
    </button>
  );
}

function MenuItem({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 rounded-xl border border-border p-3 text-left hover:bg-surface-2">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-text-3">{sub}</span>
      </span>
    </button>
  );
}

function AccountRow({
  account,
  balance,
  money,
  onClick,
}: {
  account: MoneyAccount;
  balance: number;
  money: (n: number) => string;
  onClick: () => void;
}) {
  const type = accountTypeOf(account.type);
  const I = TYPE_ICON[type.id] ?? Wallet;
  return (
    <li>
      <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: type.color }} aria-hidden>
          <I className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{account.name}</span>
          <span className="block truncate text-xs text-text-3">{type.label}</span>
        </span>
        <span className={cn("tabular text-sm font-semibold", balance < 0 && "text-bad")}>
          {balance < 0 ? "−" : ""}
          {money(Math.abs(balance))}
        </span>
      </button>
    </li>
  );
}

function DebtList({
  direction,
  debts,
  stats,
  total,
  today,
  money,
  onAdd,
  onOpen,
}: {
  direction: DebtDirection;
  debts: Debt[];
  stats: (id: string) => { added: number; repaid: number; left: number };
  total: number;
  today: string;
  money: (n: number) => string;
  onAdd: () => void;
  onOpen: (id: string) => void;
}) {
  const [showSettled, setShowSettled] = useState(false);
  const lent = direction === "lent";
  const rows = debts.map((d) => ({ d, s: stats(d.id) }));
  const open = rows
    .filter((r) => !isZero(r.s.left))
    .sort((a, b) => (a.d.dueDate ?? "9999").localeCompare(b.d.dueDate ?? "9999") || b.s.left - a.s.left);
  const settled = rows.filter((r) => isZero(r.s.left));

  const row = ({ d, s }: (typeof rows)[number]) => {
    const overdue = !isZero(s.left) && d.dueDate && d.dueDate < today;
    const dueIn = d.dueDate ? diffDays(d.dueDate, today) : null;
    return (
      <li key={d.id}>
        <button onClick={() => onOpen(d.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-2">
          <span
            className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold", lent ? "bg-good/15 text-good" : "bg-bad/15 text-bad")}
            aria-hidden
          >
            {d.person.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{d.person}</span>
            <span className={cn("block truncate text-xs", overdue ? "font-medium text-bad" : "text-text-3")}>
              {isZero(s.left)
                ? `Settled · ${money(s.added)}`
                : d.dueDate
                  ? overdue
                    ? `Overdue since ${prettyDay(d.dueDate, { weekday: undefined })}`
                    : dueIn === 0
                      ? "Due today"
                      : `Due ${relativeDayLabel(d.dueDate, today)}`
                  : d.note || (s.repaid > 0 ? `${money(s.repaid)} of ${money(s.added)} paid back` : "No due date")}
            </span>
            {!isZero(s.left) && s.repaid > 0 && (
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface-2">
                <span className={cn("block h-full rounded-full", lent ? "bg-good" : "bg-bad")} style={{ width: `${Math.min(100, (s.repaid / s.added) * 100)}%` }} />
              </span>
            )}
          </span>
          <span className={cn("tabular text-sm font-semibold", isZero(s.left) ? "text-text-3" : lent ? "text-good" : "text-bad")}>{money(Math.abs(s.left))}</span>
        </button>
      </li>
    );
  };

  return (
    <Card>
      <CardTitle
        sub={lent ? "Money you lent that's still out" : "Money you borrowed and still have to repay"}
        action={
          <Button size="sm" onClick={onAdd}>
            <Plus className="size-4" /> {lent ? "Lend" : "Borrow"}
          </Button>
        }
      >
        {lent ? "Owed to you" : "You owe"}
      </CardTitle>
      {open.length > 0 && (
        <p className={cn("tabular -mt-2 mb-3 text-2xl font-semibold tracking-tight", lent ? "text-good" : "text-bad")}>{money(total)}</p>
      )}
      {open.length === 0 ? (
        <p className="text-sm text-text-3">{lent ? "Nobody owes you anything right now." : "You don't owe anyone right now."}</p>
      ) : (
        <ul className="-mx-2 divide-y divide-border">{open.map(row)}</ul>
      )}
      {settled.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setShowSettled(!showSettled)} className="flex items-center gap-1 text-xs font-medium text-text-3 hover:text-text-2">
            <ChevronDown className={cn("size-3.5 transition-transform", showSettled && "rotate-180")} /> Settled ({settled.length})
          </button>
          {showSettled && <ul className="-mx-2 mt-1 divide-y divide-border opacity-70">{settled.map(row)}</ul>}
        </div>
      )}
    </Card>
  );
}

function AccountDetail({
  account,
  balance,
  activity,
  canTransfer,
  today,
  money,
  onEdit,
  onTransfer,
}: {
  account: MoneyAccount;
  balance: number;
  activity: Activity[];
  canTransfer: boolean;
  today: string;
  money: (n: number) => string;
  onEdit: () => void;
  onTransfer: () => void;
}) {
  const shown = activity.slice(0, 50);
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-text-3">
          {accountTypeOf(account.type).label}
          {account.archived ? " · archived" : ""}
        </p>
        <p className={cn("tabular text-3xl font-semibold tracking-tight", balance < 0 && "text-bad")}>
          {balance < 0 ? "−" : ""}
          {money(Math.abs(balance))}
        </p>
        <p className="text-xs text-text-3">Started with {money(account.openingBalance)}</p>
      </div>
      <div className="flex gap-2">
        <Button onClick={onEdit}>Edit / set balance</Button>
        {canTransfer && (
          <Button onClick={onTransfer}>
            <ArrowLeftRight className="size-4" /> Move money
          </Button>
        )}
      </div>
      <div>
        <p className="mb-1 text-sm font-medium text-text-2">Activity</p>
        {shown.length === 0 ? (
          <p className="py-4 text-sm text-text-3">
            Nothing yet. Pick this account when you add a transaction, a loan or a repayment and it shows up here.
          </p>
        ) : (
          <ul className="-mx-2 divide-y divide-border">
            {shown.map((a) => {
              const inner = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.title}</span>
                    <span className="block truncate text-xs text-text-3">
                      {relativeDayLabel(a.date, today)} · {a.sub}
                    </span>
                  </span>
                  <span className={cn("tabular text-sm font-semibold", a.amount > 0 && "text-good")}>
                    {a.amount > 0 ? "+" : "−"}
                    {money(Math.abs(a.amount))}
                  </span>
                </>
              );
              return (
                <li key={a.key}>
                  {a.open ? (
                    <button onClick={a.open} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-2">
                      {inner}
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 px-2 py-2">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {activity.length > shown.length && <p className="mt-2 text-xs text-text-3">Showing the latest {shown.length}.</p>}
      </div>
    </div>
  );
}

function DebtDetail({
  debt,
  stats,
  entries,
  accountName,
  today,
  money,
  onEntry,
  onEdit,
  onDelete,
}: {
  debt: Debt;
  stats: { added: number; repaid: number; left: number };
  entries: DebtEntry[];
  accountName: (id: string | null) => string;
  today: string;
  money: (n: number) => string;
  onEntry: (entry: DebtEntry | null, kind: "add" | "repay") => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const lent = debt.direction === "lent";
  const settled = isZero(stats.left);
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const overdue = !settled && debt.dueDate && debt.dueDate < today;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-text-3">{settled ? "All settled" : lent ? `${debt.person} owes you` : `You owe ${debt.person}`}</p>
        <p className={cn("tabular text-3xl font-semibold tracking-tight", settled ? "text-text-3" : lent ? "text-good" : "text-bad")}>
          {money(Math.abs(stats.left))}
        </p>
        <p className="text-xs text-text-3">
          {lent ? "Lent" : "Borrowed"} {money(stats.added)} · paid back {money(stats.repaid)}
        </p>
        {debt.dueDate && !settled && (
          <p className={cn("mt-1 flex items-center gap-1 text-xs", overdue ? "font-medium text-bad" : "text-text-2")}>
            <CalendarClock className="size-3.5" /> {overdue ? "Was due" : "Due"} {prettyDay(debt.dueDate)}
          </p>
        )}
        {debt.note && <p className="mt-2 text-sm text-text-2">{debt.note}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {!settled && (
          <Button variant="primary" onClick={() => onEntry(null, "repay")}>
            {lent ? "They paid back" : "I paid back"}
          </Button>
        )}
        <Button onClick={() => onEntry(null, "add")}>
          <Plus className="size-4" /> {lent ? "Lend more" : "Borrow more"}
        </Button>
      </div>
      <div>
        <p className="mb-1 text-sm font-medium text-text-2">History</p>
        <ul className="-mx-2 divide-y divide-border">
          {sorted.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => onEntry(e, e.kind as "add" | "repay")}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {e.kind === "repay" ? "Paid back" : lent ? "Lent" : "Borrowed"}
                    {e.note ? ` · ${e.note}` : ""}
                  </span>
                  <span className="block truncate text-xs text-text-3">
                    {relativeDayLabel(e.date, today)} · {accountName(e.accountId)}
                  </span>
                </span>
                <span className={cn("tabular text-sm font-semibold", e.kind === "repay" && "text-text-3")}>
                  {e.kind === "repay" ? "−" : "+"}
                  {money(e.amount)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex gap-2 border-t border-border pt-3">
        <Button variant="ghost" className="hover:text-bad" onClick={() => confirm(`Delete everything recorded with ${debt.person}?`) && onDelete()}>
          Delete
        </Button>
        <Button variant="ghost" className="ml-auto" onClick={onEdit}>
          Edit details
        </Button>
      </div>
    </div>
  );
}

// --- Forms ---------------------------------------------------------------------------------------

/** Account picker shared with the transaction form. Archived accounts only show when already chosen. */
export function AccountSelect({
  accounts,
  value,
  onChange,
  noneLabel = "No account",
  exclude,
}: {
  accounts: MoneyAccount[];
  value: string;
  onChange: (id: string) => void;
  noneLabel?: string;
  exclude?: string;
}) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{noneLabel}</option>
      {accounts
        .filter((a) => (!a.archived || a.id === value) && a.id !== exclude)
        .map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
    </Select>
  );
}

function FormError({ error }: { error: string | null }) {
  return error ? <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p> : null;
}

function AccountForm({
  account,
  balance,
  currency,
  onDone,
  onArchive,
  onDelete,
}: {
  account: MoneyAccount | null;
  balance: number;
  currency: string;
  onDone: () => void;
  onArchive: (a: MoneyAccount) => void;
  onDelete: (a: MoneyAccount) => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState(account?.type ?? "bank");
  const [amount, setAmount] = useState(account ? String(balance) : "");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await saveAccount(account?.id ?? null, { name, type, balance: Number(amount || 0) });
          if (!res.ok) return setError(res.error);
          toast(account ? "Account updated" : "Account added");
          onDone();
        });
      }}
      className="space-y-4"
    >
      <div>
        <Label>Type</Label>
        <div className="flex flex-wrap gap-1.5">
          {ACCOUNT_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              aria-pressed={type === t.id}
              className={cn(
                "rounded-full border px-2.5 py-1 text-sm",
                type === t.id ? "border-transparent text-white" : "border-border text-text-2 hover:bg-surface-2",
              )}
              style={type === t.id ? { background: t.color } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <Label>Name</Label>
        <Input
          autoFocus={!account}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={type === "savings" ? "e.g. Emergency fund" : type === "cash" ? "e.g. Wallet" : "e.g. Commercial Bank"}
          maxLength={60}
          required
        />
      </label>
      <label className="block">
        <Label hint={account ? "corrects the balance" : "what's in it today"}>Current balance ({currency})</Label>
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="h-12 text-lg font-semibold"
        />
      </label>
      {account && (
        <p className="text-xs text-text-3">Changing the balance doesn&apos;t touch past activity; it adjusts the starting balance to match.</p>
      )}
      <FormError error={error} />
      <div className="flex flex-wrap items-center gap-2">
        {account && (
          <>
            <Button
              type="button"
              variant="ghost"
              className="hover:text-bad"
              onClick={() =>
                confirm(`Delete ${account.name}? Transactions and loans linked to it are kept but won't be linked to an account.`) && onDelete(account)
              }
            >
              Delete
            </Button>
            <Button type="button" variant="ghost" onClick={() => onArchive(account)}>
              {account.archived ? "Unarchive" : "Archive"}
            </Button>
          </>
        )}
        <Button type="button" variant="ghost" className="ml-auto" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

function TransferForm({
  transfer,
  fromId,
  accounts,
  today,
  currency,
  onDone,
  onDelete,
}: {
  transfer: AccountTransfer | null;
  fromId?: string;
  accounts: MoneyAccount[];
  today: string;
  currency: string;
  onDone: () => void;
  onDelete: (id: string) => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [from, setFrom] = useState(transfer?.fromAccountId ?? fromId ?? "");
  const [to, setTo] = useState(transfer?.toAccountId ?? "");
  const [amount, setAmount] = useState(transfer ? String(transfer.amount) : "");
  const [date, setDate] = useState(transfer?.date ?? today);
  const [note, setNote] = useState(transfer?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await saveTransfer(transfer?.id ?? null, { fromAccountId: from, toAccountId: to, amount: Number(amount), date, note: note || null });
          if (!res.ok) return setError(res.error);
          toast(transfer ? "Transfer updated" : "Money moved");
          onDone();
        });
      }}
      className="space-y-4"
    >
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
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <Label>From</Label>
          <AccountSelect accounts={accounts} value={from} onChange={setFrom} noneLabel="Pick an account" exclude={to} />
        </label>
        <label className="block">
          <Label>To</Label>
          <AccountSelect accounts={accounts} value={to} onChange={setTo} noneLabel="Pick an account" exclude={from} />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <Label>Date</Label>
          <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="block">
          <Label hint="optional">Note</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Monthly saving" maxLength={300} />
        </label>
      </div>
      <FormError error={error} />
      <div className="flex items-center gap-2">
        {transfer && (
          <Button type="button" variant="ghost" className="hover:text-bad" onClick={() => confirm("Delete this transfer?") && onDelete(transfer.id)}>
            Delete
          </Button>
        )}
        <Button type="button" variant="ghost" className="ml-auto" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending || !from || !to}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

function DebtForm({
  debt,
  initialDirection,
  initialAccountId,
  debts,
  outstanding,
  accounts,
  today,
  currency,
  onDone,
  onUseExisting,
}: {
  debt: Debt | null;
  initialDirection: DebtDirection;
  initialAccountId: string | null;
  debts: Debt[];
  outstanding: Map<string, number>;
  accounts: MoneyAccount[];
  today: string;
  currency: string;
  onDone: () => void;
  onUseExisting: (d: Debt) => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [direction, setDirection] = useState<DebtDirection>(initialDirection);
  const [person, setPerson] = useState(debt?.person ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [accountId, setAccountId] = useState(initialAccountId ?? "");
  const [dueDate, setDueDate] = useState(debt?.dueDate ?? "");
  const [note, setNote] = useState(debt?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const lent = direction === "lent";
  const people = [...new Set(debts.map((d) => d.person))].sort();
  const existing = !debt
    ? debts.find((d) => d.direction === direction && d.person.trim().toLowerCase() === person.trim().toLowerCase() && !isZero(outstanding.get(d.id) ?? 0))
    : undefined;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const details = { person, direction, note: note || null, dueDate: dueDate || null };
          const res = debt
            ? await saveDebt(debt.id, details)
            : await saveDebt(null, details, { amount: Number(amount), date, accountId: accountId || null, note: null });
          if (!res.ok) return setError(res.error);
          toast(debt ? "Details updated" : lent ? `Added: ${person} owes you` : `Added: you owe ${person}`);
          onDone();
        });
      }}
      className="space-y-4"
    >
      {!debt && (
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-2 p-1">
          {(["lent", "borrowed"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setDirection(k)}
              aria-pressed={direction === k}
              className={cn("rounded-md py-1.5 text-sm", direction === k ? "bg-surface font-medium shadow-sm" : "text-text-2")}
            >
              {k === "lent" ? "Someone owes me" : "I owe someone"}
            </button>
          ))}
        </div>
      )}
      <label className="block">
        <Label>{lent ? "Who owes you?" : "Who do you owe?"}</Label>
        <Input
          autoFocus
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          placeholder={lent ? "e.g. Kasun" : "e.g. Bank loan, Amma"}
          maxLength={80}
          list="debt-people"
          required
        />
        <datalist id="debt-people">
          {people.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </label>
      {existing && (
        <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-text-2">
          There&apos;s already an open balance with {existing.person}.{" "}
          <button type="button" className="font-medium text-accent hover:underline" onClick={() => onUseExisting(existing)}>
            Add to it instead
          </button>
        </p>
      )}
      {!debt && (
        <>
          <label className="block">
            <Label>
              {lent ? "Amount they owe" : "Amount you owe"} ({currency})
            </Label>
            <Input
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
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <Label>Date</Label>
              <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label className="block">
              <Label>{lent ? "Paid from" : "Received into"}</Label>
              <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} noneLabel="No account (already owed)" />
            </label>
          </div>
          <p className="-mt-2 text-xs text-text-3">
            {accountId
              ? lent
                ? "The amount leaves this account now."
                : "The amount is added to this account now."
              : "Use this for a balance that already existed. No account balance changes."}
          </p>
        </>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <Label hint="optional">{lent ? "Pay back by" : "Repay by"}</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <label className="block">
          <Label hint="optional">Note</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={lent ? "e.g. For his bike repair" : "e.g. 12% interest"} maxLength={300} />
        </label>
      </div>
      <FormError error={error} />
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

function EntryForm({
  debt,
  entry,
  initialKind,
  outstanding,
  accounts,
  defaultAccountId,
  today,
  currency,
  onDone,
  onDelete,
}: {
  debt: Debt;
  entry: DebtEntry | null;
  initialKind: "add" | "repay";
  outstanding: number;
  accounts: MoneyAccount[];
  defaultAccountId: string | null;
  today: string;
  currency: string;
  onDone: () => void;
  onDelete: (id: string) => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState(initialKind);
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [date, setDate] = useState(entry?.date ?? today);
  const [accountId, setAccountId] = useState(entry ? (entry.accountId ?? "") : (defaultAccountId ?? ""));
  const [note, setNote] = useState(entry?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const lent = debt.direction === "lent";
  // What's outstanding without this entry, so editing a repayment can't overshoot.
  const base = round2(outstanding - (entry ? (entry.kind === "add" ? entry.amount : -entry.amount) : 0));
  const inflow = debtCashFlow(debt.direction, kind, 1) > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const n = Number(amount);
        if (kind === "repay" && n > base + 0.005) return setError(`That's more than the ${formatMoney(base, currency)} outstanding.`);
        start(async () => {
          const res = await saveDebtEntry(entry?.id ?? null, debt.id, { kind, amount: n, date, accountId: accountId || null, note: note || null });
          if (!res.ok) return setError(res.error);
          toast(entry ? "Entry updated" : kind === "repay" ? (isZero(base - n) ? "Fully paid back" : "Repayment recorded") : "Added");
          onDone();
        });
      }}
      className="space-y-4"
    >
      <p className="text-sm text-text-2">
        {lent ? `${debt.person} owes you` : `You owe ${debt.person}`} <span className="tabular font-semibold">{formatMoney(base, currency)}</span>
        {entry ? " without this entry" : ""}.
      </p>
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-2 p-1">
        {(["repay", "add"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={cn("rounded-md py-1.5 text-sm", kind === k ? "bg-surface font-medium shadow-sm" : "text-text-2")}
          >
            {k === "repay" ? (lent ? "They paid back" : "I paid back") : lent ? "I lent more" : "I borrowed more"}
          </button>
        ))}
      </div>
      <label className="block">
        <Label>Amount ({currency})</Label>
        <div className="flex gap-2">
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
          {kind === "repay" && base > 0 && (
            <Button type="button" className="h-12" onClick={() => setAmount(String(base))}>
              All of it
            </Button>
          )}
        </div>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <Label>Date</Label>
          <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="block">
          <Label>{inflow ? "Received into" : "Paid from"}</Label>
          <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
        </label>
      </div>
      <label className="block">
        <Label hint="optional">Note</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. First instalment" maxLength={300} />
      </label>
      <FormError error={error} />
      <div className="flex items-center gap-2">
        {entry && (
          <Button type="button" variant="ghost" className="hover:text-bad" onClick={() => confirm("Delete this entry?") && onDelete(entry.id)}>
            Delete
          </Button>
        )}
        <Button type="button" variant="ghost" className="ml-auto" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
