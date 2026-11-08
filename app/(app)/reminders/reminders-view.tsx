"use client";

import { BellRing, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, List, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { PageHeader } from "@/components/page-header";
import { KIND_ICON, KindIcon, ReminderRow } from "@/components/reminder-row";
import { useToast } from "@/components/toast";
import { Button, Card, cn, Empty, Fab, Input, Label, Modal, Select, Textarea } from "@/components/ui";
import { deleteReminder, saveReminder } from "@/lib/actions/reminders";
import { WEEKDAY_SHORT, addDays, dayRange, diffDays, parseDay, prettyDay, relativeDayLabel, startOfMonth, startOfWeek } from "@/lib/dates";
import type { Reminder } from "@/lib/db/schema";
import {
  ALERTS_ALL_DAY,
  ALERTS_TIMED,
  KINDS,
  KIND_META,
  REPEATS,
  REPEAT_LABEL,
  kindMeta,
  nextOccurrence,
  occurrencesBetween,
  type Kind,
  type Repeat,
} from "@/lib/reminder-schedule";

type View = "upcoming" | "calendar";
type Editing = { reminder?: Reminder; date: string; kind?: Kind };

const byTime = (a: Reminder, b: Reminder) => (a.time ?? "").localeCompare(b.time ?? "");

export function RemindersView({
  reminders,
  today,
  weekStartsOn,
  initialDate,
}: {
  reminders: Reminder[];
  today: string;
  weekStartsOn: number;
  initialDate: string | null;
}) {
  const [view, setView] = useState<View>(initialDate ? "calendar" : "upcoming");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [selected, setSelected] = useState(initialDate ?? today);

  const soon = reminders.filter((r) => {
    const n = nextOccurrence(r, today);
    return n !== null && diffDays(n, today) <= 30;
  }).length;

  const open = (r: Reminder) => setEditing({ reminder: r, date: r.date });
  const newOn = (date: string, kind?: Kind) => setEditing({ date, kind });

  return (
    <div>
      <PageHeader
        title="Reminders"
        sub={reminders.length ? `${soon} in the next 30 days` : "Birthdays, events, meetings and more"}
        action={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="flex flex-1 rounded-xl border border-border bg-surface-2 p-1 text-sm sm:flex-none sm:rounded-lg sm:p-0.5" role="tablist">
              {(
                [
                  ["upcoming", "Upcoming", List],
                  ["calendar", "Calendar", CalendarDays],
                ] as const
              ).map(([k, label, I]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={view === k}
                  onClick={() => setView(k)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 sm:flex-none sm:rounded-md sm:py-1.5",
                    view === k ? "bg-surface font-medium shadow-sm" : "text-text-2",
                  )}
                >
                  <I className="size-4" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
            <Button variant="primary" onClick={() => newOn(view === "calendar" ? selected : today)} className="max-md:hidden">
              <Plus className="size-4" /> New reminder
            </Button>
          </div>
        }
      />

      {view === "upcoming" ? (
        <Upcoming reminders={reminders} today={today} onOpen={open} onNew={(kind) => newOn(today, kind)} />
      ) : (
        <Calendar
          reminders={reminders}
          today={today}
          weekStartsOn={weekStartsOn}
          selected={selected}
          onSelect={setSelected}
          onOpen={open}
          onNew={newOn}
        />
      )}

      <Fab label="New reminder" onClick={() => newOn(view === "calendar" ? selected : today)} />
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.reminder ? "Edit reminder" : "New reminder"}
      >
        {editing && (
          <ReminderForm
            key={editing.reminder?.id ?? `${editing.date}-${editing.kind}`}
            reminder={editing.reminder}
            defaults={{ date: editing.date, kind: editing.kind }}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

// ---- Upcoming list ----------------------------------------------------------------------------

function Upcoming({
  reminders,
  today,
  onOpen,
  onNew,
}: {
  reminders: Reminder[];
  today: string;
  onOpen: (r: Reminder) => void;
  onNew: (kind: Kind) => void;
}) {
  const [showPast, setShowPast] = useState(false);

  const { groups, past } = useMemo(() => {
    const upcoming = reminders
      .map((r) => ({ r, occ: nextOccurrence(r, today) }))
      .filter((x): x is { r: Reminder; occ: string } => x.occ !== null)
      .sort((a, b) => a.occ.localeCompare(b.occ) || byTime(a.r, b.r));
    const bucket = (occ: string) => {
      const d = diffDays(occ, today);
      return d === 0 ? "Today" : d === 1 ? "Tomorrow" : d <= 7 ? "This week" : d <= 31 ? "This month" : "Later";
    };
    const groups = ["Today", "Tomorrow", "This week", "This month", "Later"]
      .map((label) => ({ label, items: upcoming.filter((x) => bucket(x.occ) === label) }))
      .filter((g) => g.items.length);
    const past = reminders.filter((r) => r.repeat === "none" && r.date < today).sort((a, b) => b.date.localeCompare(a.date));
    return { groups, past };
  }, [reminders, today]);

  if (reminders.length === 0) {
    return (
      <Empty icon={<BellRing className="size-8" />} title="No reminders yet">
        <p>Never miss a birthday, meeting or bill again.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {(["birthday", "meeting", "event", "bill"] as const).map((k) => {
            const I = KIND_ICON[k];
            return (
              <Button key={k} size="sm" onClick={() => onNew(k)}>
                <I className="size-4" style={{ color: KIND_META[k].color }} /> {KIND_META[k].label}
              </Button>
            );
          })}
        </div>
      </Empty>
    );
  }

  return (
    <div className="space-y-5">
      {groups.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-text-3">Nothing coming up.</p>
      )}
      {groups.map((g) => (
        <section key={g.label}>
          <h2 className={cn("mb-2 text-xs font-semibold tracking-wide uppercase", g.label === "Today" ? "text-accent" : "text-text-3")}>
            {g.label} · {g.items.length}
          </h2>
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {g.items.map(({ r, occ }) => (
              <ReminderRow key={r.id} reminder={r} occ={occ} today={today} onOpen={() => onOpen(r)} />
            ))}
          </div>
        </section>
      ))}
      {past.length > 0 && (
        <section>
          <button
            onClick={() => setShowPast((s) => !s)}
            aria-expanded={showPast}
            className="flex h-9 items-center gap-1 text-sm text-text-3 hover:text-text"
          >
            <ChevronDown className={cn("size-4 transition-transform", !showPast && "-rotate-90")} aria-hidden />
            Past ({past.length})
          </button>
          {showPast && (
            <div className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface opacity-80">
              {past.map((r) => (
                <ReminderRow key={r.id} reminder={r} occ={r.date} today={today} onOpen={() => onOpen(r)} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ---- Month calendar ---------------------------------------------------------------------------

const shiftMonth = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
};
const monthLabel = (month: string) =>
  parseDay(month).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });

function Calendar({
  reminders,
  today,
  weekStartsOn,
  selected,
  onSelect,
  onOpen,
  onNew,
}: {
  reminders: Reminder[];
  today: string;
  weekStartsOn: number;
  selected: string;
  onSelect: (d: string) => void;
  onOpen: (r: Reminder) => void;
  onNew: (date: string) => void;
}) {
  const [month, setMonth] = useState(startOfMonth(selected));
  const touch = useRef<{ x: number; y: number } | null>(null);

  const gridStart = startOfWeek(month, weekStartsOn);
  const gridEnd = addDays(startOfWeek(addDays(shiftMonth(month, 1), -1), weekStartsOn), 6);
  const days = dayRange(gridStart, gridEnd);

  // Which reminders fall on each visible day (the React Compiler memoizes this).
  const byDay = new Map<string, Reminder[]>();
  for (const r of reminders)
    for (const d of occurrencesBetween(r, gridStart, gridEnd)) byDay.set(d, [...(byDay.get(d) ?? []), r]);
  for (const list of byDay.values()) list.sort(byTime);

  const go = (n: number) => {
    const m = shiftMonth(month, n);
    setMonth(m);
    onSelect(m === startOfMonth(today) ? today : m);
  };
  const pick = (d: string) => {
    onSelect(d);
    if (startOfMonth(d) !== month) setMonth(startOfMonth(d));
  };
  const weekdays = Array.from({ length: 7 }, (_, i) => WEEKDAY_SHORT[(weekStartsOn + i) % 7]);
  const dayItems = byDay.get(selected) ?? occurrencesFor(reminders, selected);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <Card className="p-2 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <h2 className="text-lg font-semibold" aria-live="polite">
            {monthLabel(month)}
          </h2>
          <div className="flex items-center gap-1">
            {(month !== startOfMonth(today) || selected !== today) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setMonth(startOfMonth(today));
                  onSelect(today);
                }}
              >
                Today
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={() => go(-1)} aria-label="Previous month">
              <ChevronLeft className="size-5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => go(1)} aria-label="Next month">
              <ChevronRight className="size-5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-medium text-text-3">
          {weekdays.map((w) => (
            <span key={w}>{w.slice(0, 2)}</span>
          ))}
        </div>
        {/* Swipe left/right to change month. */}
        <div
          className="grid touch-pan-y grid-cols-7 gap-0.5 sm:gap-1"
          onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
          onTouchEnd={(e) => {
            const t = touch.current;
            touch.current = null;
            if (!t) return;
            const dx = e.changedTouches[0].clientX - t.x;
            const dy = e.changedTouches[0].clientY - t.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
          }}
        >
          {days.map((d) => {
            const items = byDay.get(d) ?? [];
            const inMonth = startOfMonth(d) === month;
            const sel = d === selected;
            const isToday = d === today;
            return (
              <button
                key={d}
                type="button"
                onClick={() => pick(d)}
                aria-pressed={sel}
                aria-label={`${prettyDay(d, { weekday: "long" })}${items.length ? `, ${items.length} reminder${items.length === 1 ? "" : "s"}` : ""}`}
                className={cn(
                  "flex h-14 min-w-0 flex-col items-center rounded-xl pt-1 transition-colors sm:h-24 sm:items-stretch sm:px-1",
                  sel ? "bg-accent-soft" : "hover:bg-surface-2 active:bg-surface-2",
                  !inMonth && "opacity-40",
                )}
              >
                <span
                  className={cn(
                    "tabular flex size-7 shrink-0 items-center justify-center rounded-full text-sm sm:self-start",
                    isToday && "bg-accent font-semibold text-accent-fg",
                    sel && !isToday && "font-semibold text-accent",
                  )}
                >
                  {Number(d.slice(8))}
                </span>
                {/* Phones: coloured dots. */}
                <span className="mt-1 flex gap-0.5 sm:hidden" aria-hidden>
                  {items.slice(0, 3).map((r) => (
                    <span key={r.id} className="size-1.5 rounded-full" style={{ background: kindMeta(r.kind).color }} />
                  ))}
                </span>
                {/* Larger screens: titles. */}
                <span className="mt-0.5 hidden min-w-0 flex-col gap-0.5 sm:flex" aria-hidden>
                  {items.slice(0, 2).map((r) => (
                    <span
                      key={r.id}
                      className="truncate rounded px-1 text-left text-[11px] leading-4 font-medium"
                      style={{ background: `color-mix(in srgb, ${kindMeta(r.kind).color} 16%, transparent)`, color: kindMeta(r.kind).color }}
                    >
                      {r.title}
                    </span>
                  ))}
                  {items.length > 2 && <span className="px-1 text-left text-[10px] text-text-3">+{items.length - 2} more</span>}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-0 sm:p-0">
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
          <div className="min-w-0">
            <h2 className="font-semibold">{prettyDay(selected, { weekday: "long", year: "numeric" })}</h2>
            <p className="text-xs text-text-3">{relativeDayLabel(selected, today)}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => onNew(selected)}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
        {dayItems.length === 0 ? (
          <p className="px-4 pt-2 pb-6 text-center text-sm text-text-3">Nothing on this day.</p>
        ) : (
          <div className="divide-y divide-border px-1 pb-1">
            {dayItems.map((r) => (
              <ReminderRow key={r.id} reminder={r} occ={selected} today={today} showDate={false} onOpen={() => onOpen(r)} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function occurrencesFor(reminders: Reminder[], day: string) {
  return reminders.filter((r) => occurrencesBetween(r, day, day).length).sort(byTime);
}

// ---- Add / edit form --------------------------------------------------------------------------

const KIND_DEFAULTS: Record<Kind, { repeat: Repeat; allDay: boolean; alert: number | null }> = {
  birthday: { repeat: "yearly", allDay: true, alert: 1440 },
  anniversary: { repeat: "yearly", allDay: true, alert: 1440 },
  event: { repeat: "none", allDay: true, alert: 0 },
  meeting: { repeat: "none", allDay: false, alert: 10 },
  bill: { repeat: "monthly", allDay: true, alert: 1440 },
  other: { repeat: "none", allDay: true, alert: 0 },
};

const PLACEHOLDER: Record<Kind, string> = {
  birthday: "Whose birthday?",
  anniversary: "e.g. Wedding anniversary",
  event: "e.g. Concert, trip, exam",
  meeting: "e.g. Team standup",
  bill: "e.g. Electricity bill",
  other: "What should we remind you about?",
};

function ReminderForm({
  reminder,
  defaults,
  onDone,
}: {
  reminder?: Reminder;
  defaults: { date: string; kind?: Kind };
  onDone: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const initialKind = (reminder?.kind as Kind) ?? defaults.kind ?? "event";
  const d0 = KIND_DEFAULTS[initialKind];
  const [kind, setKind] = useState<Kind>(initialKind);
  const [title, setTitle] = useState(reminder?.title ?? "");
  const [date, setDate] = useState(reminder?.date ?? defaults.date);
  const [allDay, setAllDay] = useState(reminder ? !reminder.time : d0.allDay);
  const [time, setTime] = useState(reminder?.time ?? "09:00");
  const [repeat, setRepeat] = useState<Repeat>((reminder?.repeat as Repeat) ?? d0.repeat);
  const [alert, setAlert] = useState<number | null>(reminder ? reminder.alertMinutes : d0.alert);
  const [location, setLocation] = useState(reminder?.location ?? "");
  const [notes, setNotes] = useState(reminder?.notes ?? "");

  const alertOptions = allDay ? ALERTS_ALL_DAY : ALERTS_TIMED;
  const notifyOff = alert !== null && (typeof Notification === "undefined" || Notification.permission !== "granted");

  function chooseKind(k: Kind) {
    setKind(k);
    if (reminder) return; // don't override settings on an existing reminder
    const d = KIND_DEFAULTS[k];
    setRepeat(d.repeat);
    setAllDay(d.allDay);
    setAlert(d.alert);
  }

  function toggleAllDay(v: boolean) {
    setAllDay(v);
    const opts = v ? ALERTS_ALL_DAY : ALERTS_TIMED;
    if (!opts.some((o) => o.v === alert)) setAlert(opts[1].v);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await saveReminder(reminder?.id ?? null, {
        title,
        kind,
        date,
        time: allDay ? null : time,
        repeat,
        location: location.trim() || null,
        notes: notes.trim() || null,
        alertMinutes: alert,
      });
      if (!res.ok) return setError(res.error);
      toast(reminder ? "Reminder updated" : "Reminder added");
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Type">
        {KINDS.map((k) => {
          const on = kind === k;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => chooseKind(k)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border py-2 text-xs font-medium transition-colors",
                on ? "border-transparent bg-accent-soft text-text" : "border-border text-text-2 active:bg-surface-2",
              )}
              style={on ? { boxShadow: `inset 0 0 0 2px ${KIND_META[k].color}` } : undefined}
            >
              <KindIcon kind={k} className="size-8 rounded-lg [&_svg]:size-4" />
              {KIND_META[k].label}
            </button>
          );
        })}
      </div>

      <label className="block">
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder={PLACEHOLDER[kind]} maxLength={200} />
      </label>

      <label className="block">
        <Label hint={kind === "birthday" ? "the year is used to show their age" : undefined}>
          {kind === "birthday" ? "Birth date" : kind === "anniversary" ? "Original date" : "Date"}
        </Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-text-2">All day</span>
        <button
          type="button"
          role="switch"
          aria-checked={allDay}
          aria-label="All day"
          onClick={() => toggleAllDay(!allDay)}
          className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", allDay ? "bg-accent" : "bg-border")}
        >
          <span
            className={cn("absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform", allDay && "translate-x-5")}
          />
        </button>
      </div>
      {!allDay && (
        <label className="block">
          <Label>Time</Label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <Label>Repeat</Label>
          <Select value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)}>
            {REPEATS.map((r) => (
              <option key={r} value={r}>
                {REPEAT_LABEL[r]}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <Label>Alert</Label>
          <Select value={alert === null ? "" : String(alert)} onChange={(e) => setAlert(e.target.value === "" ? null : Number(e.target.value))}>
            {alertOptions.map((o) => (
              <option key={o.label} value={o.v === null ? "" : String(o.v)}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
      </div>
      {notifyOff && (
        <p className="rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">
          Alerts arrive as push notifications.{" "}
          <Link href="/settings" className="font-medium underline">
            Turn on notifications
          </Link>{" "}
          on this device to get them.
        </p>
      )}

      {(kind === "meeting" || kind === "event") && (
        <label className="block">
          <Label hint="optional">Location or link</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Office, Zoom link, address…" maxLength={200} />
        </label>
      )}

      <label className="block">
        <Label hint="optional">Notes</Label>
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={kind === "birthday" ? "Gift ideas, how to reach them…" : undefined}
        />
      </label>

      {error && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        {reminder && (
          <Button
            type="button"
            variant="ghost"
            className="mr-auto text-bad hover:bg-bad/10 hover:text-bad"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Delete "${reminder.title}"?`)) return;
              start(async () => {
                await deleteReminder(reminder.id);
                toast("Reminder deleted");
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
          {pending ? "Saving…" : reminder ? "Save" : "Add reminder"}
        </Button>
      </div>
    </form>
  );
}

