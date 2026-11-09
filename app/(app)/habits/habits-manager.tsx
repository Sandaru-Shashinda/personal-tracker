"use client";

import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Bell, Flame, Pencil, Plus, Repeat, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { HabitForm } from "@/components/habit-form";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { Button, cn, Empty, Input, Modal, Select, Fab } from "@/components/ui";
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
          <Button variant="primary" onClick={() => setCreating(true)} className="max-md:hidden">
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
              className={cn("rounded-md px-4 py-1.5 text-sm capitalize", tab === t ? "bg-surface font-medium shadow-sm" : "text-text-2")}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="relative min-w-40 flex-1 max-sm:order-first max-sm:basis-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search habits" className="pl-9" aria-label="Search habits" />
        </div>
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-auto max-sm:flex-1" aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">Uncategorised</option>
        </Select>
        {allTags.length > 0 && (
          <Select value={tag} onChange={(e) => setTag(e.target.value)} className="w-auto max-sm:flex-1" aria-label="Filter by tag">
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
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-text-3">
                <th className="sticky left-0 z-10 bg-surface px-4 py-2.5 font-medium">Habit</th>
                <th className="px-3 py-2.5 font-medium">Category</th>
                <th className="px-3 py-2.5 font-medium">Tags</th>
                <th className="px-3 py-2.5 text-right font-medium">Streak</th>
                <th className="px-3 py-2.5 text-right font-medium">Best</th>
                <th className="px-3 py-2.5 text-right font-medium">30-day</th>
                <th className="px-3 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((h) => {
                const s = stats[h.id];
                const c = h.categoryId ? catById.get(h.categoryId) : undefined;
                const pos = active.findIndex((a) => a.id === h.id);
                return (
                  <tr key={h.id} className="group hover:bg-surface-2/50">
                    <td className="sticky left-0 z-10 bg-surface px-4 py-2.5 group-hover:bg-surface-2">
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: h.color }}>
                          <Icon name={h.icon} className="size-4" />
                        </span>
                        <div className="min-w-0 max-w-56">
                          <Link href={`/habits/${h.id}`} className="block truncate font-medium hover:underline">
                            {h.title}
                          </Link>
                          <p className="flex items-center gap-1.5 truncate text-xs text-text-3">
                            {frequencyLabel(h)}
                            {h.type === "count" && ` · ${h.target} ${h.unit ?? ""}`}
                            {h.reminderTime && (
                              <span className="inline-flex items-center gap-0.5">
                                · <Bell className="size-3" aria-label="Reminder" /> {h.reminderTime}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {c ? (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-text-2">
                          <span className="size-2 rounded-full" style={{ background: c.color }} aria-hidden />
                          {c.name}
                        </span>
                      ) : (
                        <span className="text-text-3">–</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {h.tags.length ? (
                        <div className="flex flex-wrap gap-1 text-xs">
                          {h.tags.map((t) => (
                            <span key={t} className="rounded-md bg-surface-2 px-2 py-0.5 text-text-2">
                              #{t}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-text-3">–</span>
                      )}
                    </td>
                    <td className="tabular px-3 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1 font-semibold">
                        {s.streak > 0 && <Flame className="size-3.5 text-warn" aria-hidden />}
                        {s.streak}
                        <span className="font-normal text-text-3">{s.unit === "weeks" ? "w" : "d"}</span>
                      </span>
                    </td>
                    <td className="tabular px-3 py-2.5 text-right text-text-2">
                      {s.best}
                      <span className="text-text-3">{s.unit === "weeks" ? "w" : "d"}</span>
                    </td>
                    <td className="tabular px-3 py-2.5 text-right">{s.rate === null ? "–" : `${Math.round(s.rate * 100)}%`}</td>
                    <td className="tabular px-3 py-2.5 text-right">{s.total}</td>
                    <td className="px-4 py-1.5">
                      <div className="flex items-center justify-end gap-0.5">
                        {canReorder && (
                          <>
                            <button onClick={() => move(h.id, -1)} disabled={pos === 0} className="flex size-8 items-center justify-center rounded-md text-text-3 hover:text-text active:bg-surface-2 disabled:opacity-30" aria-label="Move up" title="Move up">
                              <ArrowUp className="size-4" />
                            </button>
                            <button onClick={() => move(h.id, 1)} disabled={pos === active.length - 1} className="flex size-8 items-center justify-center rounded-md text-text-3 hover:text-text active:bg-surface-2 disabled:opacity-30" aria-label="Move down" title="Move down">
                              <ArrowDown className="size-4" />
                            </button>
                          </>
                        )}
                        <button onClick={() => setEditing(h)} className="flex size-8 items-center justify-center rounded-md text-text-3 hover:text-text active:bg-surface-2" aria-label="Edit" title="Edit">
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => start(() => setHabitArchived(h.id, !h.archived))}
                          className="flex size-8 items-center justify-center rounded-md text-text-3 hover:text-text active:bg-surface-2"
                          aria-label={h.archived ? "Restore" : "Archive"}
                          title={h.archived ? "Restore" : "Archive"}
                        >
                          {h.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                        </button>
                        {h.archived && (
                          <button
                            onClick={() => {
                              if (confirm(`Permanently delete "${h.title}" and all its history?`)) start(() => deleteHabit(h.id));
                            }}
                            className="flex size-8 items-center justify-center rounded-md text-text-3 hover:text-bad active:bg-surface-2"
                            aria-label="Delete"
                            title="Delete"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Fab label="New habit" onClick={() => setCreating(true)} />
      <Modal open={creating} onClose={() => setCreating(false)} title="New habit" wide>
        <HabitForm categories={categories} onDone={() => setCreating(false)} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit habit" wide>
        {editing && <HabitForm key={editing.id} habit={editing} categories={categories} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}
