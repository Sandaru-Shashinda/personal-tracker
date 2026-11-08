"use client";

import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Bell, Flame, Pencil, Plus, Repeat, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { HabitForm } from "@/components/habit-form";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { Button, cn, Empty, Input, Modal, Select } from "@/components/ui";
import { deleteHabit, reorderHabits, setHabitArchived } from "@/lib/actions/habits";
import type { Category, Habit } from "@/lib/db/schema";
import { frequencyLabel } from "@/lib/format";

type Stats = Record<string, { streak: number; best: number; unit: "days" | "weeks"; rate: number | null; total: number }>;

export function HabitsManager({ habits, categories, stats }: { habits: Habit[]; categories: Category[]; stats: Stats }) {
  const [, start] = useTransition();
  const [editing, setEditing] = useState<Habit | null>(null);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [tag, setTag] = useState("");
  const catById = new Map(categories.map((c) => [c.id, c]));
  const allTags = useMemo(() => [...new Set(habits.flatMap((h) => h.tags))].sort(), [habits]);

  const list = habits.filter(
    (h) =>
      (tab === "active" ? !h.archived : h.archived) &&
      (!q || h.title.toLowerCase().includes(q.toLowerCase())) &&
      (!cat || (cat === "none" ? !h.categoryId : h.categoryId === cat)) &&
      (!tag || h.tags.includes(tag)),
  );
  const active = habits.filter((h) => !h.archived);
  const canReorder = tab === "active" && !q && !cat && !tag;

  const move = (id: string, dir: -1 | 1) => {
    const ids = active.map((h) => h.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    start(() => reorderHabits(ids));
  };

  return (
    <div>
      <PageHeader
        title="Habits"
        sub={`${active.length} active · ${habits.length - active.length} archived`}
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New habit
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border bg-surface-2 p-1">
          {(["active", "archived"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn("rounded-md px-3 py-1 text-sm capitalize", tab === t ? "bg-surface font-medium shadow-sm" : "text-text-2")}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="relative min-w-40 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search habits" className="pl-9" aria-label="Search habits" />
        </div>
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-auto" aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">Uncategorised</option>
        </Select>
        {allTags.length > 0 && (
          <Select value={tag} onChange={(e) => setTag(e.target.value)} className="w-auto" aria-label="Filter by tag">
            <option value="">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </Select>
        )}
      </div>

      {list.length === 0 ? (
        <Empty icon={<Repeat className="size-8" />} title={tab === "active" ? "No habits here" : "Nothing archived"}>
          {tab === "active" && "Create a habit to start building streaks."}
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((h) => {
            const s = stats[h.id];
            const c = h.categoryId ? catById.get(h.categoryId) : undefined;
            const pos = active.findIndex((a) => a.id === h.id);
            return (
              <div key={h.id} className="group flex flex-col rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: h.color }}>
                    <Icon name={h.icon} className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/habits/${h.id}`} className="block truncate font-medium hover:underline">
                      {h.title}
                    </Link>
                    <p className="text-xs text-text-3">
                      {frequencyLabel(h)}
                      {h.type === "count" && ` · ${h.target} ${h.unit ?? ""}`}
                    </p>
                  </div>
                  {canReorder && (
                    <div className="flex flex-col opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <button onClick={() => move(h.id, -1)} disabled={pos === 0} className="text-text-3 hover:text-text disabled:opacity-30" aria-label="Move up">
                        <ArrowUp className="size-4" />
                      </button>
                      <button onClick={() => move(h.id, 1)} disabled={pos === active.length - 1} className="text-text-3 hover:text-text disabled:opacity-30" aria-label="Move down">
                        <ArrowDown className="size-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  {c && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-text-2">
                      <span className="size-2 rounded-full" style={{ background: c.color }} aria-hidden />
                      {c.name}
                    </span>
                  )}
                  {h.reminderTime && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-text-2">
                      <Bell className="size-3" aria-hidden /> {h.reminderTime}
                    </span>
                  )}
                  {h.tags.map((t) => (
                    <span key={t} className="rounded-md bg-surface-2 px-2 py-0.5 text-text-2">
                      #{t}
                    </span>
                  ))}
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
                  <div>
                    <dt className="text-[11px] text-text-3">Streak</dt>
                    <dd className="tabular flex items-center justify-center gap-0.5 font-semibold">
                      {s.streak > 0 && <Flame className="size-3.5 text-warn" aria-hidden />}
                      {s.streak}
                      <span className="text-xs font-normal text-text-3">{s.unit === "weeks" ? "w" : "d"}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-text-3">30-day</dt>
                    <dd className="tabular font-semibold">{s.rate === null ? "–" : `${Math.round(s.rate * 100)}%`}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-text-3">Total</dt>
                    <dd className="tabular font-semibold">{s.total}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(h)}>
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => start(() => setHabitArchived(h.id, !h.archived))}>
                    {h.archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
                    {h.archived ? "Restore" : "Archive"}
                  </Button>
                  {h.archived && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="hover:text-bad"
                      onClick={() => {
                        if (confirm(`Permanently delete "${h.title}" and all its history?`)) start(() => deleteHabit(h.id));
                      }}
                    >
                      <Trash2 className="size-3.5" /> Delete
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New habit" wide>
        <HabitForm categories={categories} onDone={() => setCreating(false)} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit habit" wide>
        {editing && <HabitForm key={editing.id} habit={editing} categories={categories} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}
