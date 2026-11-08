"use client";

import { useState, useTransition } from "react";
import { createHabit, updateHabit, type HabitInput } from "@/lib/actions/habits";
import type { Category, Habit } from "@/lib/db/schema";
import { WEEKDAY_SHORT } from "@/lib/dates";
import { Icon, PICKABLE_ICONS } from "./icons";
import { useToast } from "./toast";
import { Button, cn, ColorPicker, Input, Label, Select, TagInput, Textarea } from "./ui";

export function HabitForm({
  habit,
  categories,
  onDone,
}: {
  habit?: Habit;
  categories: Category[];
  onDone: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState<Required<Omit<HabitInput, "startDate">>>({
    title: habit?.title ?? "",
    description: habit?.description ?? "",
    color: habit?.color ?? "#2a78d6",
    icon: habit?.icon ?? "check",
    categoryId: habit?.categoryId ?? null,
    type: habit?.type ?? "check",
    target: habit?.target ?? 1,
    unit: habit?.unit ?? "",
    frequency: habit?.frequency ?? "daily",
    daysOfWeek: habit?.daysOfWeek ?? [1, 2, 3, 4, 5],
    timesPerWeek: habit?.timesPerWeek ?? 3,
    tags: habit?.tags ?? [],
    reminderTime: habit?.reminderTime ?? null,
  });
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const payload: HabitInput = {
        ...v,
        description: v.description || null,
        unit: v.unit || null,
        reminderTime: v.reminderTime || null,
        target: Number(v.target) || 1,
      };
      const res = habit ? await updateHabit(habit.id, payload) : await createHabit(payload);
      if (!res.ok) return setError(res.error);
      toast(habit ? "Habit updated" : "Habit created");
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <Label>Name</Label>
        <Input
          autoFocus
          value={v.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. Drink water, Read, Meditate"
          required
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Kind</Label>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-2 p-1">
            {(
              [
                ["check", "Yes / no"],
                ["count", "Measurable"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => set("type", k)}
                className={cn(
                  "rounded-md py-1.5 text-sm",
                  v.type === k ? "bg-surface font-medium shadow-sm" : "text-text-2",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <Label>Category</Label>
          <Select value={v.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value || null)}>
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {v.type === "count" && (
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <Label>Daily target</Label>
            <Input
              type="number"
              min={0.1}
              step="any"
              value={v.target}
              onChange={(e) => set("target", e.target.value as unknown as number)}
              required
            />
          </label>
          <label className="block">
            <Label>Unit</Label>
            <Input value={v.unit ?? ""} onChange={(e) => set("unit", e.target.value)} placeholder="glasses, min, pages" />
          </label>
        </div>
      )}

      <div>
        <Label>How often</Label>
        <Select
          value={v.frequency}
          onChange={(e) => set("frequency", e.target.value as typeof v.frequency)}
          className="mb-2"
        >
          <option value="daily">Every day</option>
          <option value="days">Specific days of the week</option>
          <option value="weekly">A number of times per week</option>
        </Select>
        {v.frequency === "days" && (
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_SHORT.map((d, i) => {
              const on = v.daysOfWeek.includes(i);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    set("daysOfWeek", on ? v.daysOfWeek.filter((x) => x !== i) : [...v.daysOfWeek, i].sort())
                  }
                  className={cn(
                    "h-9 w-12 rounded-lg border text-sm",
                    on ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-text-2",
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
        )}
        {v.frequency === "weekly" && (
          <div className="flex items-center gap-2 text-sm text-text-2">
            <Input
              type="number"
              min={1}
              max={7}
              className="w-20"
              value={v.timesPerWeek}
              onChange={(e) => set("timesPerWeek", Number(e.target.value))}
            />
            times per week
          </div>
        )}
      </div>

      <div>
        <Label>Icon & color</Label>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PICKABLE_ICONS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => set("icon", name)}
              aria-label={name}
              aria-pressed={v.icon === name}
              className={cn(
                "flex size-9 items-center justify-center rounded-lg border",
                v.icon === name ? "border-transparent text-white" : "border-border text-text-2 hover:bg-surface-2",
              )}
              style={v.icon === name ? { background: v.color } : undefined}
            >
              <Icon name={name} className="size-4" />
            </button>
          ))}
        </div>
        <ColorPicker value={v.color} onChange={(c) => set("color", c)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <Label hint="optional">Reminder</Label>
          <Input
            type="time"
            value={v.reminderTime ?? ""}
            onChange={(e) => set("reminderTime", e.target.value || null)}
          />
        </label>
        <div>
          <Label hint="optional">Tags</Label>
          <TagInput value={v.tags} onChange={(t) => set("tags", t)} />
        </div>
      </div>

      <label className="block">
        <Label hint="optional">Notes / why</Label>
        <Textarea
          rows={2}
          value={v.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Why does this matter to you?"
        />
      </label>

      {error && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : habit ? "Save changes" : "Create habit"}
        </Button>
      </div>
    </form>
  );
}
