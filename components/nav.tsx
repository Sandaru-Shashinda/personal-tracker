"use client";

import {
  BellRing,
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
import { Suspense, useEffect, useState } from "react";
import { cn, useSwipeToClose } from "./ui";
import { ThemeSelect, ThemeToggle } from "./theme-toggle";

type NavLink = { href: string; label: string; icon: LucideIcon };

const L = {
  today: { href: "/today", label: "Today", icon: CalendarCheck },
  dashboard: { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  habits: { href: "/habits", label: "Habits", icon: Repeat },
  tasks: { href: "/tasks", label: "Tasks", icon: ListTodo },
  goals: { href: "/goals", label: "Goals", icon: Flag },
  reminders: { href: "/reminders", label: "Reminders", icon: BellRing },
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
  { title: "Track", links: [L.habits, L.tasks, L.reminders, L.goals, L.gym] },
  { title: "Life", links: [L.journal, L.notes, L.todo, L.expenses, L.personal] },
];
const BOTTOM: NavLink[] = [L.today, L.habits, L.tasks, L.gym];
const MORE: NavLink[] = [...GROUPS.flatMap((g) => g.links), L.settings].filter((l) => !BOTTOM.includes(l));

const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");

/** Height of the bottom tab bar above the safe area. The More sheet and the FAB sit on top of it. */
const BAR = "4rem";
const ABOVE_BAR = `calc(${BAR} + env(safe-area-inset-bottom))`;

type Variant = "side" | "bottom";

const TAB_CLASS = "flex flex-col items-center justify-center gap-1 select-none";

function TabItem({ icon: I, label, active }: { icon: LucideIcon; label: string; active: boolean }) {
  return (
    <>
      <span
        className={cn(
          "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
          active ? "bg-accent-soft text-accent" : "text-text-3",
        )}
      >
        <I className="size-[22px]" strokeWidth={active ? 2.25 : 1.9} aria-hidden />
      </span>
      <span className={cn("text-[11px] leading-none", active ? "font-semibold text-text" : "font-medium text-text-3")}>
        {label}
      </span>
    </>
  );
}

function LinksView({ links, path, variant }: { links: NavLink[]; path: string; variant: Variant }) {
  return (
    <>
      {links.map(({ href, label, icon: I }) => {
        const active = isActive(path, href);
        return variant === "side" ? (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-accent-soft text-accent" : "text-text-2 hover:bg-surface-2 hover:text-text",
            )}
          >
            <I className="size-4" aria-hidden />
            {label}
          </Link>
        ) : (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={TAB_CLASS}>
            <TabItem icon={I} label={label} active={active} />
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

function MoreSheet({ path, userSlot }: { path: string; userSlot: React.ReactNode }) {
  // The sheet is open only for the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const close = () => setOpenOn(null);
  const active = MORE.some((l) => isActive(path, l.href));
  const { ref: panel, handlers: swipe } = useSwipeToClose<HTMLDivElement>(close);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenOn(open ? null : path)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={TAB_CLASS}
      >
        <TabItem icon={open ? X : MoreHorizontal} label="More" active={active || open} />
      </button>
      {open && (
        <>
          <div
            className="backdrop-in fixed inset-x-0 top-0 z-30 bg-black/40"
            style={{ bottom: ABOVE_BAR }}
            onClick={close}
            aria-hidden
          />
          <div
            ref={panel}
            role="dialog"
            aria-label="More"
            data-sheet-open
            className="sheet-panel fixed inset-x-0 z-40 max-h-[75dvh] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-border bg-surface shadow-2xl"
            style={{ bottom: ABOVE_BAR }}
          >
            <div className="touch-none px-4 pt-2 pb-2" {...swipe}>
              <div className="mx-auto h-1.5 w-10 rounded-full bg-border" aria-hidden />
            </div>
            <div className="grid grid-cols-4 gap-1 px-3 pb-3">
              {MORE.map(({ href, label, icon: I }) => {
                const on = isActive(path, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={close}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-2xl py-2.5 text-xs font-medium transition-colors active:bg-surface-2",
                      on ? "text-accent" : "text-text-2",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-12 items-center justify-center rounded-2xl",
                        on ? "bg-accent text-accent-fg" : "bg-surface-2 text-text",
                      )}
                    >
                      <I className="size-5" aria-hidden />
                    </span>
                    {label}
                  </Link>
                );
              })}
            </div>
            <div className="space-y-4 border-t border-border px-4 pt-4 pb-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-text-2">Theme</span>
                <ThemeSelect />
              </div>
              {userSlot}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function ActiveMore({ userSlot }: { userSlot: React.ReactNode }) {
  return <MoreSheet path={usePathname()} userSlot={userSlot} />;
}

export function MobileNav({ userSlot }: { userSlot: React.ReactNode }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
    >
      <div className="grid grid-cols-5" style={{ height: BAR }}>
        <NavLinks links={BOTTOM} variant="bottom" />
        <Suspense fallback={<MoreSheet path="" userSlot={userSlot} />}>
          <ActiveMore userSlot={userSlot} />
        </Suspense>
      </div>
    </nav>
  );
}
