import {
  BellRing,
  BookHeart,
  CalendarCheck,
  Dumbbell,
  Flag,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  NotebookPen,
  Repeat,
  Settings,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type Section = { href: string; label: string; icon: LucideIcon; color: string };

/** Every area of the app, with the colour that identifies it in the nav and page headers. */
export const SECTIONS = {
  today: { href: "/today", label: "Today", icon: CalendarCheck, color: "#f59e0b" },
  dashboard: { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, color: "#6366f1" },
  habits: { href: "/habits", label: "Habits", icon: Repeat, color: "#10b981" },
  tasks: { href: "/tasks", label: "Tasks", icon: ListTodo, color: "#3b82f6" },
  goals: { href: "/goals", label: "Goals", icon: Flag, color: "#e11d48" },
  reminders: { href: "/reminders", label: "Reminders", icon: BellRing, color: "#f97316" },
  gym: { href: "/gym", label: "Gym", icon: Dumbbell, color: "#8b5cf6" },
  journal: { href: "/journal", label: "Journal", icon: BookHeart, color: "#ec4899" },
  notes: { href: "/notes", label: "Notes", icon: NotebookPen, color: "#06b6d4" },
  todo: { href: "/todo", label: "To-do", icon: ListChecks, color: "#14b8a6" },
  expenses: { href: "/expenses", label: "Expenses", icon: Wallet, color: "#22a35a" },
  personal: { href: "/personal", label: "Personal", icon: UserRound, color: "#0ea5e9" },
  settings: { href: "/settings", label: "Settings", icon: Settings, color: "#64748b" },
} satisfies Record<string, Section>;

export const sectionByLabel = (label: string): Section | undefined =>
  Object.values(SECTIONS).find((s) => s.label === label);

/** Inline style that feeds a section colour to the `chip-solid` / `chip-soft` utilities. */
export const chipColor = (color: string) => ({ "--c": color }) as React.CSSProperties;
