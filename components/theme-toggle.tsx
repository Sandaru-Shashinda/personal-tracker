"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "./ui";

const subscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const order = ["system", "light", "dark"] as const;
  const current = mounted ? ((theme as (typeof order)[number]) ?? "system") : "system";
  const Icon = current === "dark" ? Moon : current === "light" ? Sun : Monitor;
  return (
    <button
      type="button"
      onClick={() => setTheme(order[(order.indexOf(current) + 1) % order.length])}
      className="flex size-9 items-center justify-center rounded-lg text-text-2 hover:bg-surface-2 hover:text-text"
      aria-label={`Theme: ${current}. Click to change`}
      title={`Theme: ${current}`}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

export function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const opts = [
    { v: "light", label: "Light", icon: Sun },
    { v: "dark", label: "Dark", icon: Moon },
    { v: "system", label: "System", icon: Monitor },
  ];
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface-2 p-1" role="radiogroup" aria-label="Theme">
      {opts.map(({ v, label, icon: I }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={mounted && theme === v}
          onClick={() => setTheme(v)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm",
            mounted && theme === v ? "bg-surface font-medium text-text shadow-sm" : "text-text-2",
          )}
        >
          <I className="size-4" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
