"use client";

import {
  BookHeart,
  CalendarCheck,
  Dumbbell,
  Flag,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  MoreHorizontal,
  NotebookPen,
  Repeat,
  Settings,
  Target,
  UserRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { cn } from "./ui";
import { ThemeToggle } from "./theme-toggle";

type NavLink = { href: string; label: string; icon: LucideIcon };

const L = {
  today: { href: "/today", label: "Today", icon: CalendarCheck },
  dashboard: { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  habits: { href: "/habits", label: "Habits", icon: Repeat },
  tasks: { href: "/tasks", label: "Tasks", icon: ListTodo },
  goals: { href: "/goals", label: "Goals", icon: Flag },
  gym: { href: "/gym", label: "Gym", icon: Dumbbell },
  journal: { href: "/journal", label: "Journal", icon: BookHeart },
  notes: { href: "/notes", label: "Notes", icon: NotebookPen },
  todo: { href: "/todo", label: "To-do", icon: ListChecks },
  expenses: { href: "/expenses", label: "Expenses", icon: Wallet },
  personal: { href: "/personal", label: "Personal", icon: UserRound },
  settings: { href: "/settings", label: "Settings", icon: Settings },
} satisfies Record<string, NavLink>;

const GROUPS: { title?: string; links: NavLink[] }[] = [
  { links: [L.today, L.dashboard] },
  { title: "Track", links: [L.habits, L.tasks, L.goals, L.gym] },
  { title: "Life", links: [L.journal, L.notes, L.todo, L.expenses, L.personal] },
];
const BOTTOM: NavLink[] = [L.today, L.habits, L.tasks, L.gym];
const MORE: NavLink[] = [...GROUPS.flatMap((g) => g.links), L.settings].filter((l) => !BOTTOM.includes(l));

const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");

type Variant = "side" | "bottom";

function LinksView({ links, path, variant }: { links: NavLink[]; path: string; variant: Variant }) {
  return (
    <>
      {links.map(({ href, label, icon: I }) => {
        const active = isActive(path, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              variant === "side"
                ? cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active ? "bg-accent-soft text-accent" : "text-text-2 hover:bg-surface-2 hover:text-text",
                  )
                : cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-accent" : "text-text-3")
            }
          >
            <I className={variant === "side" ? "size-4" : "size-5"} aria-hidden />
            {label}
          </Link>
        );
      })}
    </>
  );
}

function ActiveLinks({ links, variant }: { links: NavLink[]; variant: Variant }) {
  return <LinksView links={links} path={usePathname()} variant={variant} />;
}

/** The pathname is request data, so the highlighted state streams in; the links render immediately. */
function NavLinks({ links, variant }: { links: NavLink[]; variant: Variant }) {
  return (
    <Suspense fallback={<LinksView links={links} path="" variant={variant} />}>
      <ActiveLinks links={links} variant={variant} />
    </Suspense>
  );
}

export function Sidebar({ userSlot }: { userSlot: React.ReactNode }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 md:flex">
      <Link href="/today" className="mb-5 flex items-center gap-2 px-3">
        <span className="flex size-8 items-center justify-center rounded-xl bg-accent text-accent-fg">
          <Target className="size-4" aria-hidden />
        </span>
        <span className="text-lg font-semibold tracking-tight">Tracker</span>
      </Link>
      <nav className="-mx-1 flex flex-1 flex-col gap-0.5 overflow-y-auto px-1" aria-label="Main">
        {GROUPS.map((g, i) => (
          <div key={i} className={cn("flex flex-col gap-0.5", i > 0 && "mt-3")}>
            {g.title && <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-text-3 uppercase">{g.title}</p>}
            <NavLinks links={g.links} variant="side" />
          </div>
        ))}
        <div className="mt-3 flex flex-col gap-0.5">
          <NavLinks links={[L.settings]} variant="side" />
        </div>
      </nav>
      <div className="flex items-center justify-between gap-2 border-t border-border px-1 pt-4">
        {userSlot}
        <ThemeToggle />
      </div>
    </aside>
  );
}

function MoreSheet({ path }: { path: string }) {
  // The sheet is open only for the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) =>
    setOpenOn((typeof v === "function" ? v(open) : v) ? path : null);
  const active = MORE.some((l) => isActive(path, l.href));

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active || open ? "text-accent" : "text-text-3")}
      >
        {open ? <X className="size-5" aria-hidden /> : <MoreHorizontal className="size-5" aria-hidden />}
        More
      </button>
      {open && (
        <>
          <div className="fixed inset-0 bottom-[calc(57px+env(safe-area-inset-bottom))] z-30 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="fixed inset-x-0 bottom-[calc(57px+env(safe-area-inset-bottom))] z-40 grid grid-cols-4 gap-1 rounded-t-2xl border-t border-border bg-surface p-3"
          >
            {MORE.map(({ href, label, icon: I }) => (
              <Link
                key={href}
                href={href}
                role="menuitem"
                onClick={() => setOpen(false)}
                aria-current={isActive(path, href) ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl py-3 text-xs font-medium",
                  isActive(path, href) ? "bg-accent-soft text-accent" : "text-text-2 hover:bg-surface-2",
                )}
              >
                <I className="size-5" aria-hidden />
                {label}
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function ActiveMore() {
  return <MoreSheet path={usePathname()} />;
}

export function MobileNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <NavLinks links={BOTTOM} variant="bottom" />
      <Suspense fallback={<MoreSheet path="" />}>
        <ActiveMore />
      </Suspense>
    </nav>
  );
}

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur md:hidden">
      <Link href="/today" className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-accent-fg">
          <Target className="size-4" aria-hidden />
        </span>
        <span className="font-semibold">Tracker</span>
      </Link>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <Link
          href="/settings"
          aria-label="Settings"
          className="flex size-9 items-center justify-center rounded-lg text-text-2 hover:bg-surface-2"
        >
          <Settings className="size-5" aria-hidden />
        </Link>
      </div>
    </header>
  );
}
