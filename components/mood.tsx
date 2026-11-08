"use client";

import { cn } from "./ui";

export const MOODS = [
  { v: 1, emoji: "😞", label: "Awful" },
  { v: 2, emoji: "😕", label: "Bad" },
  { v: 3, emoji: "😐", label: "Okay" },
  { v: 4, emoji: "🙂", label: "Good" },
  { v: 5, emoji: "😄", label: "Great" },
];

export const ENERGY = [
  { v: 1, label: "Drained" },
  { v: 2, label: "Low" },
  { v: 3, label: "Steady" },
  { v: 4, label: "Charged" },
  { v: 5, label: "Peak" },
];

export function moodEmoji(m: number | null | undefined) {
  return MOODS.find((x) => x.v === m)?.emoji ?? "";
}

export function MoodPicker({
  value,
  onChange,
  size = "md",
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  size?: "md" | "lg";
}) {
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Mood">
      {MOODS.map((m) => (
        <button
          key={m.v}
          type="button"
          role="radio"
          aria-checked={value === m.v}
          aria-label={m.label}
          title={m.label}
          onClick={() => onChange(value === m.v ? null : m.v)}
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 rounded-xl border transition",
            size === "lg" ? "py-2.5 text-3xl" : "py-1.5 text-2xl",
            value === m.v
              ? "border-accent bg-accent-soft"
              : "border-transparent opacity-60 grayscale-[40%] hover:opacity-100 hover:grayscale-0",
          )}
        >
          <span aria-hidden>{m.emoji}</span>
          <span className="text-[10px] font-medium text-text-2">{m.label}</span>
        </button>
      ))}
    </div>
  );
}

export function EnergyPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Energy">
      {ENERGY.map((e) => (
        <button
          key={e.v}
          type="button"
          role="radio"
          aria-checked={value === e.v}
          onClick={() => onChange(value === e.v ? null : e.v)}
          className={cn(
            "flex flex-1 flex-col items-center gap-1 rounded-lg border px-1 py-1.5 text-[11px]",
            value === e.v ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-text-2",
          )}
        >
          <span className="flex h-3 items-end gap-px" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className={cn("w-1 rounded-sm", i < e.v ? "bg-current" : "bg-border")}
                style={{ height: `${(i + 1) * 20}%` }}
              />
            ))}
          </span>
          {e.label}
        </button>
      ))}
    </div>
  );
}
