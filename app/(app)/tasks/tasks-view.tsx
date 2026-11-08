"use client";

import { ListTodo, Plus, Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { PageHeader } from "@/components/page-header";
import { TaskForm } from "@/components/task-form";
import { TaskRow } from "@/components/task-row";
import { useToast } from "@/components/toast";
import { Button, cn, Empty, Fab, Input, Modal, Select } from "@/components/ui";
import { clearCompletedTasks, createTask } from "@/lib/actions/tasks";
import { addDays } from "@/lib/dates";
import type { Category, Task } from "@/lib/db/schema";

type Filter = "all" | "today" | "upcoming" | "overdue" | "someday" | "done";
type Sort = "smart" | "due" | "priority" | "created";

export function TasksView({ tasks, categories, today }: { tasks: Task[]; categories: Category[]; today: string }) {
  const toast = useToast();
  const [, start] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("smart");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [tag, setTag] = useState("");
  const [quick, setQuick] = useState("");
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState<{ parentId?: string; dueDate?: string } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const catById = new Map(categories.map((c) => [c.id, c]));
  const subtasksOf = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) if (t.parentId) m.set(t.parentId, [...(m.get(t.parentId) ?? []), t]);
    return m;
  }, [tasks]);
  const tags = useMemo(() => [...new Set(tasks.flatMap((t) => t.tags))].sort(), [tasks]);
  const top = tasks.filter((t) => !t.parentId);
  const weekAhead = addDays(today, 7);

  const counts = {
    all: top.filter((t) => !t.completedAt).length,
    today: top.filter((t) => !t.completedAt && t.dueDate === today).length,
    upcoming: top.filter((t) => !t.completedAt && t.dueDate && t.dueDate > today).length,
    overdue: top.filter((t) => !t.completedAt && t.dueDate && t.dueDate < today).length,
    someday: top.filter((t) => !t.completedAt && !t.dueDate).length,
    done: top.filter((t) => t.completedAt).length,
  };

  const matches = (t: Task) => {
    const done = !!t.completedAt;
    const f =
      filter === "all"
        ? !done
        : filter === "done"
          ? done
          : filter === "today"
            ? !done && t.dueDate === today
            : filter === "upcoming"
              ? !done && !!t.dueDate && t.dueDate > today
              : filter === "overdue"
                ? !done && !!t.dueDate && t.dueDate < today
                : !done && !t.dueDate;
    const text = q.toLowerCase();
    const subs = subtasksOf.get(t.id) ?? [];
    return (
      f &&
      (!text ||
        t.title.toLowerCase().includes(text) ||
        (t.notes ?? "").toLowerCase().includes(text) ||
        subs.some((s) => s.title.toLowerCase().includes(text))) &&
      (!cat || (cat === "none" ? !t.categoryId : t.categoryId === cat)) &&
      (!tag || t.tags.includes(tag))
    );
  };

  const sorted = top.filter(matches).sort((a, b) => {
    if (filter === "done") return (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0);
    const due = (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
    if (sort === "due") return due || b.priority - a.priority;
    if (sort === "priority") return b.priority - a.priority || due;
    if (sort === "created") return b.createdAt.getTime() - a.createdAt.getTime();
    return due || b.priority - a.priority;
  });

  // Group by due bucket in the "all" view for scannability.
  const groups: { label: string; items: Task[] }[] = [];
  if (filter === "all" && sort === "smart") {
    const b = (t: Task) =>
      !t.dueDate ? "Someday" : t.dueDate < today ? "Overdue" : t.dueDate === today ? "Today" : t.dueDate <= weekAhead ? "This week" : "Later";
    for (const label of ["Overdue", "Today", "This week", "Later", "Someday"]) {
      const items = sorted.filter((t) => b(t) === label);
      if (items.length) groups.push({ label, items });
    }
  } else groups.push({ label: "", items: sorted });

  const toggleExpand = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const FILTERS: { k: Filter; label: string }[] = [
    { k: "all", label: "Open" },
    { k: "today", label: "Today" },
    { k: "overdue", label: "Overdue" },
    { k: "upcoming", label: "Upcoming" },
    { k: "someday", label: "No date" },
    { k: "done", label: "Completed" },
  ];

  return (
    <div>
      <PageHeader
        title="Tasks"
        sub={`${counts.all} open${counts.overdue ? ` · ${counts.overdue} overdue` : ""}`}
        action={
          <Button variant="primary" onClick={() => setCreating({})} className="max-md:hidden">
            <Plus className="size-4" /> New task
          </Button>
        }
      />

      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const title = quick.trim();
          if (!title) return;
          setQuick("");
          start(async () => {
            const r = await createTask({
              title,
              dueDate: filter === "today" ? today : null,
              categoryId: cat && cat !== "none" ? cat : null,
              tags: tag ? [tag] : [],
            });
            if (!r.ok) toast(r.error, "bad");
          });
        }}
      >
        <Input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Add a task and press Enter…" aria-label="Quick add task" />
        <Button type="submit" variant="primary" aria-label="Add">
          <Plus className="size-4" />
        </Button>
      </form>

      <div className="no-scrollbar -mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.k}
            role="tab"
            aria-selected={filter === f.k}
            onClick={() => setFilter(f.k)}
            className={cn(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors",
              filter === f.k
                ? "border-transparent bg-accent-soft font-medium text-accent"
                : "border-border bg-surface text-text-2 hover:bg-surface-2",
            )}
          >
            {f.label}
            <span className={cn("tabular rounded px-1.5 text-xs", f.k === "overdue" && counts.overdue ? "bg-bad/10 text-bad" : "bg-surface-2 text-text-3")}>
              {counts[f.k]}
            </span>
          </button>
        ))}
      </div>

      <div className="relative mb-2 sm:hidden">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks" className="pl-9" aria-label="Search tasks" />
      </div>
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <div className="relative min-w-40 flex-1 max-sm:hidden">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks" className="pl-9" aria-label="Search tasks" />
        </div>
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-auto shrink-0" aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">Uncategorised</option>
        </Select>
        {tags.length > 0 && (
          <Select value={tag} onChange={(e) => setTag(e.target.value)} className="w-auto shrink-0" aria-label="Tag">
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </Select>
        )}
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="w-auto shrink-0" aria-label="Sort">
          <option value="smart">Smart sort</option>
          <option value="due">Due date</option>
          <option value="priority">Priority</option>
          <option value="created">Newest</option>
        </Select>
        {filter === "done" && counts.done > 0 && (
          <Button
            variant="ghost"
            className="hover:text-bad"
            onClick={() => confirm(`Delete all ${counts.done} completed tasks?`) && start(() => clearCompletedTasks())}
          >
            Clear completed
          </Button>
        )}
      </div>

      {sorted.length === 0 ? (
        <Empty icon={<ListTodo className="size-8" />} title={filter === "done" ? "Nothing completed yet" : "All clear"}>
          {filter !== "done" && "No tasks match. Add one above."}
        </Empty>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.label || "all"}>
              {g.label && (
                <h2 className={cn("mb-2 text-xs font-semibold uppercase tracking-wide", g.label === "Overdue" ? "text-bad" : "text-text-3")}>
                  {g.label} · {g.items.length}
                </h2>
              )}
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                {g.items.map((t) => {
                  const subs = subtasksOf.get(t.id) ?? [];
                  const isOpen = expanded.has(t.id) || (!!q && subs.length > 0);
                  return (
                    <div key={t.id}>
                      <TaskRow
                        task={t}
                        today={today}
                        category={t.categoryId ? catById.get(t.categoryId) : undefined}
                        subtasks={subs}
                        expanded={isOpen}
                        onToggleExpand={() => toggleExpand(t.id)}
                        onEdit={() => setEditing(t)}
                        onAddSubtask={() => {
                          setExpanded((s) => new Set(s).add(t.id));
                          setCreating({ parentId: t.id, dueDate: t.dueDate ?? undefined });
                        }}
                      />
                      {isOpen && subs.length > 0 && (
                        <div className="ml-8 border-l border-border">
                          {subs.map((s) => (
                            <TaskRow key={s.id} task={s} today={today} onEdit={() => setEditing(s)} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <Fab label="New task" onClick={() => setCreating({})} />
      <Modal open={!!creating} onClose={() => setCreating(null)} title={creating?.parentId ? "New subtask" : "New task"}>
        {creating && (
          <TaskForm
            categories={categories}
            defaults={{ parentId: creating.parentId, dueDate: creating.dueDate ?? (filter === "today" ? today : null) }}
            onDone={() => setCreating(null)}
          />
        )}
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit task">
        {editing && <TaskForm key={editing.id} task={editing} categories={categories} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}
