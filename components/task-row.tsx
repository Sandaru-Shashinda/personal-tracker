"use client";

import { Bell, Calendar, Check, ChevronRight, ListTree, Pencil, Trash2 } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { deleteTask, toggleTask } from "@/lib/actions/tasks";
import { relativeDayLabel } from "@/lib/dates";
import type { Category, Task } from "@/lib/db/schema";
import { PRIORITIES } from "./task-form";
import { useToast } from "./toast";
import { cn } from "./ui";

export function TaskRow({
  task,
  today,
  category,
  subtasks = [],
  onEdit,
  onAddSubtask,
  expanded,
  onToggleExpand,
  compact,
}: {
  task: Task;
  today: string;
  category?: Category;
  subtasks?: Task[];
  onEdit?: () => void;
  onAddSubtask?: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
  compact?: boolean;
}) {
  const toast = useToast();
  const [, start] = useTransition();
  const [done, setDone] = useOptimistic(!!task.completedAt);
  const overdue = !done && task.dueDate && task.dueDate < today;
  const p = PRIORITIES[task.priority];
  const subDone = subtasks.filter((s) => s.completedAt).length;

  const toggle = () =>
    start(async () => {
      setDone(!done);
      try {
        await toggleTask(task.id, !done);
        if (!done) toast("Nice, task done ✓");
      } catch {
        toast("Couldn't update task", "bad");
      }
    });

  return (
    <div className="group flex items-start gap-3 px-3 py-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`Mark "${task.title}" ${done ? "not done" : "done"}`}
        onClick={toggle}
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
          done ? "border-accent bg-accent text-white" : "border-text-3 hover:border-accent",
          !done && task.priority === 3 && "border-bad",
          !done && task.priority === 2 && "border-warn",
        )}
      >
        {done && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {onToggleExpand && subtasks.length > 0 && (
            <button
              type="button"
              onClick={onToggleExpand}
              aria-label={expanded ? "Hide subtasks" : "Show subtasks"}
              className="text-text-3 hover:text-text"
            >
              <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            disabled={!onEdit}
            className={cn("truncate text-left text-sm", done && "text-text-3 line-through")}
          >
            {task.title}
          </button>
        </div>
        {!compact && task.notes && <p className="mt-0.5 line-clamp-1 text-xs text-text-3">{task.notes}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-3">
          {task.dueDate && (
            <span className={cn("inline-flex items-center gap-1", overdue && "font-medium text-bad")}>
              <Calendar className="size-3" aria-hidden />
              {overdue ? "Overdue · " : ""}
              {relativeDayLabel(task.dueDate, today)}
            </span>
          )}
          {task.priority > 0 && <span className={cn("font-medium", p.cls)}>{p.label} priority</span>}
          {category && (
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ background: category.color }} aria-hidden />
              {category.name}
            </span>
          )}
          {subtasks.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListTree className="size-3" aria-hidden />
              {subDone}/{subtasks.length}
            </span>
          )}
          {task.reminderAt && !task.reminderSent && (
            <span className="inline-flex items-center gap-1" suppressHydrationWarning>
              <Bell className="size-3" aria-hidden />
              {task.reminderAt.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>
          )}
          {task.tags.map((t) => (
            <span key={t}>#{t}</span>
          ))}
        </div>
      </div>
      {!compact && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
          {onAddSubtask && !task.parentId && (
            <button
              type="button"
              onClick={onAddSubtask}
              className="flex size-8 items-center justify-center rounded-lg text-text-3 hover:bg-surface-2 hover:text-text"
              aria-label="Add subtask"
              title="Add subtask"
            >
              <ListTree className="size-4" aria-hidden />
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex size-8 items-center justify-center rounded-lg text-text-3 hover:bg-surface-2 hover:text-text"
              aria-label="Edit task"
            >
              <Pencil className="size-4" aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete "${task.title}"${subtasks.length ? " and its subtasks" : ""}?`))
                start(() => deleteTask(task.id));
            }}
            className="flex size-8 items-center justify-center rounded-lg text-text-3 hover:bg-bad/10 hover:text-bad"
            aria-label="Delete task"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
