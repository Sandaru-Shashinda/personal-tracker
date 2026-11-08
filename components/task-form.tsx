"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { createTask, deleteTask, updateTask } from "@/lib/actions/tasks";
import type { Category, Task } from "@/lib/db/schema";
import { useToast } from "./toast";
import { Button, cn, Input, Label, Select, TagInput, Textarea } from "./ui";

export const PRIORITIES = [
  { v: 0, label: "None", cls: "text-text-3" },
  { v: 1, label: "Low", cls: "text-accent" },
  { v: 2, label: "Medium", cls: "text-warn" },
  { v: 3, label: "High", cls: "text-bad" },
];

function toLocalInput(d: Date | null) {
  if (!d) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function TaskForm({
  task,
  categories,
  defaults,
  onDone,
}: {
  task?: Task;
  categories: Category[];
  defaults?: { dueDate?: string | null; parentId?: string | null };
  onDone: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [priority, setPriority] = useState(task?.priority ?? 0);
  const [dueDate, setDueDate] = useState(task?.dueDate ?? defaults?.dueDate ?? "");
  const [categoryId, setCategoryId] = useState(task?.categoryId ?? "");
  const [tags, setTags] = useState<string[]>(task?.tags ?? []);
  const [reminder, setReminder] = useState(toLocalInput(task?.reminderAt ?? null));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const input = {
        title,
        notes: notes || null,
        priority,
        dueDate: dueDate || null,
        categoryId: categoryId || null,
        tags,
        reminderAt: reminder ? new Date(reminder).toISOString() : null,
        parentId: task ? undefined : (defaults?.parentId ?? null),
      };
      const res = task ? await updateTask(task.id, input) : await createTask(input);
      if (!res.ok) return setError(res.error);
      toast(task ? "Task updated" : "Task added");
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <Label>Task</Label>
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="What needs doing?" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <Label>Due date</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <label className="block">
          <Label>Category</Label>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div>
        <Label>Priority</Label>
        <div className="grid grid-cols-4 gap-1 rounded-lg border border-border bg-surface-2 p-1">
          {PRIORITIES.map((p) => (
            <button
              key={p.v}
              type="button"
              onClick={() => setPriority(p.v)}
              aria-pressed={priority === p.v}
              className={cn("rounded-md py-2 text-sm sm:py-1.5", priority === p.v ? `bg-surface font-medium shadow-sm ${p.cls}` : "text-text-2")}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <Label hint="push notification">Remind me</Label>
          <Input type="datetime-local" value={reminder} onChange={(e) => setReminder(e.target.value)} />
        </label>
        <div>
          <Label hint="optional">Tags</Label>
          <TagInput value={tags} onChange={setTags} />
        </div>
      </div>
      <label className="block">
        <Label hint="optional">Notes</Label>
        <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {error && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        {task && (
          <Button
            type="button"
            variant="ghost"
            className="mr-auto text-bad hover:bg-bad/10 hover:text-bad"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Delete "${task.title}" and any subtasks?`)) return;
              start(async () => {
                await deleteTask(task.id);
                toast("Task deleted");
                onDone();
              });
            }}
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : task ? "Save" : "Add task"}
        </Button>
      </div>
    </form>
  );
}
