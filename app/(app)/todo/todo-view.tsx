"use client";

import { Check, ChevronDown, ListChecks, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast";
import { Button, cn, ColorPicker, COLORS, Empty, Input, Label, Modal } from "@/components/ui";
import { addItem, clearDoneItems, deleteItem, deleteList, renameItem, saveList, toggleItem } from "@/lib/actions/todo";
import type { TodoItem, TodoList } from "@/lib/db/schema";

const SUGGESTIONS = ["My to-do", "Groceries", "Shopping", "Packing", "Ideas"];

type OptAction =
  | { type: "add"; item: TodoItem }
  | { type: "toggle"; id: string; done: boolean }
  | { type: "delete"; id: string }
  | { type: "clear"; listId: string };

export function TodoView({ lists, items }: { lists: TodoList[]; items: TodoItem[] }) {
  const toast = useToast();
  const [, start] = useTransition();
  const [selected, setSelected] = useState<string | null>(lists[0]?.id ?? null);
  const [editingList, setEditingList] = useState<TodoList | "new" | null>(null);
  const [opt, apply] = useOptimistic(items, (state: TodoItem[], a: OptAction) => {
    if (a.type === "add") return [...state, a.item];
    if (a.type === "toggle") return state.map((i) => (i.id === a.id ? { ...i, done: a.done } : i));
    if (a.type === "delete") return state.filter((i) => i.id !== a.id);
    return state.filter((i) => !(i.listId === a.listId && i.done));
  });

  const list = lists.find((l) => l.id === selected) ?? lists[0];
  const listItems = list ? opt.filter((i) => i.listId === list.id) : [];
  const openCount = (id: string) => opt.filter((i) => i.listId === id && !i.done).length;

  const createQuick = (name: string, i: number) =>
    start(async () => {
      const res = await saveList(null, { name, color: COLORS[i % COLORS.length] });
      if (!res.ok) return toast(res.error, "bad");
      setSelected(res.id);
    });

  if (!list) {
    return (
      <div>
        <PageHeader title="To-do" sub="Quick checklists for groceries, shopping, packing and more" />
        <Empty icon={<ListChecks className="size-8" />} title="Create your first list">
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s, i) => (
              <Button key={s} size="sm" onClick={() => createQuick(s, i)}>
                <Plus className="size-3.5" /> {s}
              </Button>
            ))}
            <Button size="sm" variant="primary" onClick={() => setEditingList("new")}>
              Custom…
            </Button>
          </div>
        </Empty>
        <Modal open={!!editingList} onClose={() => setEditingList(null)} title="New list">
          <ListForm
            list={null}
            onDone={(id) => {
              setEditingList(null);
              if (id) setSelected(id);
            }}
          />
        </Modal>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="To-do"
        sub="Quick checklists. For dated tasks with priorities, use Tasks."
        action={
          <Button onClick={() => setEditingList("new")}>
            <Plus className="size-4" /> New list
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Lists" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-col md:overflow-visible md:p-0">
          {lists.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelected(l.id)}
              aria-current={l.id === list.id ? "true" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors md:border-transparent",
                l.id === list.id ? "border-transparent bg-accent-soft font-medium text-accent" : "border-border text-text-2 hover:bg-surface-2",
              )}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: l.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{l.name}</span>
              <span className="tabular text-xs text-text-3">{openCount(l.id) || ""}</span>
            </button>
          ))}
        </nav>

        <ListPanel
          key={list.id}
          list={list}
          items={listItems}
          onEdit={() => setEditingList(list)}
          onDeleteList={() => {
            if (!confirm(`Delete the list "${list.name}" and all its items?`)) return;
            start(async () => {
              await deleteList(list.id);
              setSelected(lists.find((l) => l.id !== list.id)?.id ?? null);
              toast("List deleted");
            });
          }}
          apply={apply}
        />
      </div>

      <Modal open={!!editingList} onClose={() => setEditingList(null)} title={editingList === "new" ? "New list" : "Edit list"}>
        {editingList && (
          <ListForm
            list={editingList === "new" ? null : editingList}
            onDone={(id) => {
              setEditingList(null);
              if (id) setSelected(id);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function ListPanel({
  list,
  items,
  onEdit,
  onDeleteList,
  apply,
}: {
  list: TodoList;
  items: TodoItem[];
  onEdit: () => void;
  onDeleteList: () => void;
  apply: (a: OptAction) => void;
}) {
  const toast = useToast();
  const [, start] = useTransition();
  const [text, setText] = useState("");
  const [showDone, setShowDone] = useState(true);
  const [menu, setMenu] = useState(false);
  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    start(async () => {
      apply({
        type: "add",
        item: { id: `tmp-${Date.now()}`, listId: list.id, userId: "", text: t, done: false, createdAt: new Date() },
      });
      const res = await addItem(list.id, t);
      if (!res.ok) toast(res.error, "bad");
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="size-3 rounded-full" style={{ background: list.color }} aria-hidden />
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{list.name}</h2>
        <span className="text-sm text-text-3">
          {done.length}/{items.length} done
        </span>
        <div className="relative">
          <Button variant="ghost" size="icon" onClick={() => setMenu((m) => !m)} aria-label="List options" aria-expanded={menu}>
            <MoreHorizontal className="size-4" />
          </Button>
          {menu && (
            <div
              className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-border bg-surface p-1 shadow-lg"
              onMouseLeave={() => setMenu(false)}
            >
              <MenuItem onClick={() => (setMenu(false), onEdit())} icon={<Pencil className="size-4" />}>
                Rename / colour
              </MenuItem>
              <MenuItem
                disabled={!done.length}
                onClick={() => {
                  setMenu(false);
                  start(async () => {
                    apply({ type: "clear", listId: list.id });
                    await clearDoneItems(list.id);
                  });
                }}
                icon={<Check className="size-4" />}
              >
                Clear completed
              </MenuItem>
              <MenuItem onClick={() => (setMenu(false), onDeleteList())} icon={<Trash2 className="size-4" />} danger>
                Delete list
              </MenuItem>
            </div>
          )}
        </div>
      </div>

      {items.length > 0 && (
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${(done.length / items.length) * 100}%`, background: list.color }}
          />
        </div>
      )}

      <form onSubmit={add} className="mb-3 flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an item and press Enter" maxLength={500} aria-label="New item" />
        <Button type="submit" variant="primary" disabled={!text.trim()} aria-label="Add item">
          <Plus className="size-4" />
        </Button>
      </form>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-3">This list is empty.</p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {open.map((i) => (
              <ItemRow key={i.id} item={i} color={list.color} apply={apply} />
            ))}
          </ul>
          {open.length === 0 && <p className="py-4 text-center text-sm text-good">All done 🎉</p>}
          {done.length > 0 && (
            <div className="mt-3">
              <button onClick={() => setShowDone((s) => !s)} className="flex items-center gap-1 py-1 text-sm font-medium text-text-3">
                <ChevronDown className={cn("size-4 transition-transform", !showDone && "-rotate-90")} />
                Completed ({done.length})
              </button>
              {showDone && (
                <ul className="divide-y divide-border">
                  {done.map((i) => (
                    <ItemRow key={i.id} item={i} color={list.color} apply={apply} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function MenuItem({
  children,
  icon,
  onClick,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface-2 disabled:opacity-40",
        danger ? "text-bad" : "text-text-2",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function ItemRow({ item, color, apply }: { item: TodoItem; color: string; apply: (a: OptAction) => void }) {
  const toast = useToast();
  const [, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);
  const temp = item.id.startsWith("tmp-");

  function commit() {
    setEditing(false);
    const t = text.trim();
    if (!t || t === item.text) return setText(item.text);
    start(async () => {
      const res = await renameItem(item.id, t);
      if (!res.ok) toast(res.error, "bad");
    });
  }

  return (
    <li className={cn("group flex items-center gap-3 py-2", temp && "opacity-60")}>
      <button
        disabled={temp}
        onClick={() =>
          start(async () => {
            apply({ type: "toggle", id: item.id, done: !item.done });
            await toggleItem(item.id, !item.done);
          })
        }
        aria-label={item.done ? `Mark "${item.text}" not done` : `Mark "${item.text}" done`}
        aria-pressed={item.done}
        className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
        style={item.done ? { background: color, borderColor: color } : { borderColor: "var(--text-3)" }}
      >
        {item.done && <Check className="size-3 text-white" strokeWidth={3} />}
      </button>
      {editing ? (
        <Input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setText(item.text);
              setEditing(false);
            }
          }}
          className="h-8"
          maxLength={500}
        />
      ) : (
        <span
          onDoubleClick={() => !temp && setEditing(true)}
          className={cn("min-w-0 flex-1 text-sm break-words", item.done && "text-text-3 line-through")}
        >
          {item.text}
        </span>
      )}
      {!editing && !temp && (
        <span className="flex shrink-0 can-hover:opacity-0 can-hover:group-hover:opacity-100 can-hover:focus-within:opacity-100">
          <button
            onClick={() => setEditing(true)}
            className="flex size-9 items-center justify-center rounded-md text-text-3 hover:bg-surface-2 hover:text-text active:bg-surface-2 can-hover:size-7"
            aria-label={`Edit "${item.text}"`}
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={() =>
              start(async () => {
                apply({ type: "delete", id: item.id });
                await deleteItem(item.id);
              })
            }
            className="flex size-9 items-center justify-center rounded-md text-text-3 hover:bg-surface-2 hover:text-bad active:bg-surface-2 can-hover:size-7"
            aria-label={`Delete "${item.text}"`}
          >
            <Trash2 className="size-3.5" />
          </button>
        </span>
      )}
    </li>
  );
}

function ListForm({ list, onDone }: { list: TodoList | null; onDone: (id?: string) => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState(list?.name ?? "");
  const [color, setColor] = useState(list?.color ?? COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveList(list?.id ?? null, { name, color });
          if (!res.ok) return setError(res.error);
          toast(list ? "List updated" : "List created");
          onDone(res.id);
        });
      }}
      className="space-y-4"
    >
      <label className="block">
        <Label>Name</Label>
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Groceries" maxLength={60} required />
      </label>
      <div>
        <Label>Colour</Label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      {error && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : list ? "Save" : "Create list"}
        </Button>
      </div>
    </form>
  );
}
