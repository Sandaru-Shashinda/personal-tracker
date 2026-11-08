"use client";

import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HabitForm } from "@/components/habit-form";
import { Button, Modal } from "@/components/ui";
import { deleteHabit, setHabitArchived } from "@/lib/actions/habits";
import type { Category, Habit } from "@/lib/db/schema";

export function HabitActions({ habit, categories }: { habit: Habit; categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex gap-2">
      <Button onClick={() => setOpen(true)}>
        <Pencil className="size-4" /> Edit
      </Button>
      <Button disabled={pending} onClick={() => start(() => setHabitArchived(habit.id, !habit.archived))}>
        {habit.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
        {habit.archived ? "Restore" : "Archive"}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Delete habit"
        className="hover:text-bad"
        onClick={() => {
          if (!confirm(`Permanently delete "${habit.title}" and all its history?`)) return;
          start(async () => {
            await deleteHabit(habit.id);
            router.push("/habits");
          });
        }}
      >
        <Trash2 className="size-4" />
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit habit" wide>
        <HabitForm habit={habit} categories={categories} onDone={() => setOpen(false)} />
      </Modal>
    </div>
  );
}
