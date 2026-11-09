"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Pencil,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { ExerciseAnim } from "@/components/exercise-anim";
import { useToast } from "@/components/toast";
import { Button, Card, cn, Empty, Input, Modal } from "@/components/ui";
import { addToPlan, completePlanItem, removeExerciseFromDay, removeFromPlan, reorderPlan, updatePlanItem } from "@/lib/actions/gym";
import { addDays, dayOfWeek, dayRange, prettyDay, relativeDayLabel } from "@/lib/dates";
import { groupOf, isTimed, type ExerciseLite } from "@/lib/gym/groups";
import { ExercisePicker, fmtKg, GroupBadge, lastSession, setLabel, type SetRow } from "./gym-view";

export type PlanItem = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  sets: number;
  reps: number | null;
  weight: number | null;
  durationSec: number | null;
  daysOfWeek: number[];
  /** Day the exercise was added; earlier days don't count as missed. */
  since: string;
};

type Target = { sets: number; reps: number | null; weight: number | null; durationSec: number | null };

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function weekOrder(weekStartsOn: number) {
  return Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);
}

export function targetLabel(t: Target) {
  if (t.durationSec) return `${t.sets > 1 ? `${t.sets} × ` : ""}${Math.round(t.durationSec / 60)} min${t.weight ? ` · ${fmtKg(t.weight)}` : ""}`;
  return `${t.sets} × ${t.reps ?? 0}${t.weight ? ` · ${fmtKg(t.weight)}` : " · body"}`;
}

/** What was logged for one exercise on one day, as a single target when every set is the same. */
function summarise(sets: SetRow[]): { label: string; top: number | null } {
  const top = sets.reduce<number | null>((m, s) => (s.weight !== null && (m === null || s.weight > m) ? s.weight : m), null);
  const first = sets[0];
  const uniform = sets.every((s) => s.reps === first.reps && s.weight === first.weight && s.durationSec === first.durationSec);
  if (uniform) return { label: targetLabel({ sets: sets.length, reps: first.reps, weight: first.weight, durationSec: first.durationSec }), top };
  return { label: sets.map((s) => setLabel(s)).join(", "), top };
}

export function DayNav({ date, setDate, today }: { date: string; setDate: (d: string) => void; today: string }) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
        <ChevronLeft className="size-4" />
      </Button>
      <Input
        type="date"
        value={date}
        max={today}
        onChange={(e) => e.target.value && setDate(e.target.value > today ? today : e.target.value)}
        className="w-40"
        aria-label="Date"
      />
      <Button variant="ghost" size="icon" onClick={() => setDate(addDays(date, 1))} disabled={date >= today} aria-label="Next day">
        <ChevronRight className="size-4" />
      </Button>
      <span className="ml-1 text-sm font-medium text-text-2">{relativeDayLabel(date, today)}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ Today checklist */

export function PlanTab({
  date,
  setDate,
  today,
  sets,
  plan,
  byId,
  exercises,
  weekStartsOn,
}: {
  date: string;
  setDate: (d: string) => void;
  today: string;
  sets: SetRow[];
  plan: PlanItem[];
  byId: Map<string, ExerciseLite>;
  exercises: ExerciseLite[];
  weekStartsOn: number;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showOthers, setShowOthers] = useState(false);
  const wd = dayOfWeek(date);
  const daySets = sets.filter((s) => s.date === date);
  const scheduled = plan.filter((p) => p.daysOfWeek.includes(wd));
  const others = plan.filter((p) => !p.daysOfWeek.includes(wd));
  const doneIds = new Set(daySets.map((s) => s.exerciseId));
  const doneCount = scheduled.filter((p) => doneIds.has(p.exerciseId)).length;
  const pct = scheduled.length ? Math.round((doneCount / scheduled.length) * 100) : 0;

  const row = (p: PlanItem) => (
    <PlanRow
      key={p.id}
      item={p}
      exercise={byId.get(p.exerciseId)}
      date={date}
      logged={daySets.filter((s) => s.exerciseId === p.exerciseId)}
      previous={lastSession(sets, p.exerciseId, date)}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DayNav date={date} setDate={setDate} today={today} />
        {plan.length > 0 && (
          <div className="flex gap-2">
            <Button onClick={() => setEditing(true)}>
              <Pencil className="size-4" /> Edit plan
            </Button>
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Add
            </Button>
          </div>
        )}
      </div>

      {plan.length === 0 ? (
        <Empty icon={<ClipboardList className="size-8" />} title="Build your exercise plan">
          <span className="block">Pick exercises by muscle group, set your sets, reps and weight, then tick them off each day.</span>
          <Button variant="primary" className="mt-4" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Choose exercises
          </Button>
        </Empty>
      ) : (
        <>
          <Card className="p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium">
                {scheduled.length === 0 ? `Rest day — nothing planned for ${WEEKDAY_NAMES[wd]}` : `${doneCount} of ${scheduled.length} done`}
              </p>
              {scheduled.length > 0 && <span className="tabular text-sm text-text-3">{pct}%</span>}
            </div>
            {scheduled.length > 0 && (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-good transition-[width]" style={{ width: `${pct}%` }} />
              </div>
            )}
          </Card>

          {scheduled.length > 0 && <ul className="space-y-2">{scheduled.map(row)}</ul>}

          {others.length > 0 && (
            <div>
              <button
                onClick={() => setShowOthers((v) => !v)}
                className="flex items-center gap-1 text-sm font-medium text-text-2 hover:text-text"
                aria-expanded={showOthers}
              >
                <ChevronDown className={cn("size-4 transition-transform", !showOthers && "-rotate-90")} />
                Not planned for {WEEKDAY_NAMES[wd]} ({others.length})
              </button>
              {showOthers && <ul className="mt-2 space-y-2">{others.map(row)}</ul>}
            </div>
          )}
        </>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add exercises to your plan" wide>
        {adding && <AddToPlan exercises={exercises} plan={plan} sets={sets} onDone={() => setAdding(false)} />}
      </Modal>
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit plan" wide>
        {editing && (
          <PlanEditor
            plan={plan}
            byId={byId}
            weekStartsOn={weekStartsOn}
            onAdd={() => {
              setEditing(false);
              setAdding(true);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function PlanRow({
  item,
  exercise,
  date,
  logged,
  previous,
}: {
  item: PlanItem;
  exercise?: ExerciseLite;
  date: string;
  logged: SetRow[];
  previous: { date: string; sets: SetRow[] } | null;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [done, setDone] = useOptimistic(logged.length > 0);
  const [open, setOpen] = useState(false);
  const timed = exercise ? isTimed(exercise) : !!item.durationSec;
  const seed = logged[0];
  const [form, setForm] = useState({
    sets: String(logged.length || item.sets),
    reps: String((seed ? seed.reps : item.reps) ?? ""),
    weight: String((seed ? seed.weight : item.weight) ?? ""),
    minutes: String(Math.round(((seed ? seed.durationSec : item.durationSec) ?? 0) / 60) || ""),
  });

  const target = (): Target => ({
    sets: Math.max(1, Math.round(Number(form.sets) || 1)),
    reps: timed ? null : Math.round(Number(form.reps)) || null,
    weight: form.weight === "" ? null : Number(form.weight),
    durationSec: timed ? Math.round((Number(form.minutes) || 0) * 60) || null : null,
  });

  function complete() {
    const t = target();
    start(async () => {
      setDone(true);
      const res = await completePlanItem(date, item.id, t);
      if (!res.ok) toast(res.error, "bad");
      else setOpen(false);
    });
  }

  function toggle() {
    if (!done) return complete();
    start(async () => {
      setDone(false);
      await removeExerciseFromDay(date, item.exerciseId);
    });
  }

  const now = logged.length ? summarise(logged) : null;
  const prev = previous ? summarise(previous.sets) : null;
  const shownTop = now?.top ?? item.weight;
  const delta = prev?.top != null && shownTop != null ? Math.round((shownTop - prev.top) * 10) / 10 : null;
  const group = exercise ? groupOf(exercise) : undefined;

  return (
    <li className={cn("rounded-2xl border bg-surface shadow-card transition-colors", done ? "border-good/40" : "border-border")}>
      <div className="flex items-center gap-3 p-3">
        <button
          onClick={toggle}
          disabled={pending}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            done ? "border-good bg-good text-white" : "border-border hover:border-good",
          )}
          aria-label={done ? `Mark ${item.exerciseName} not done` : `Mark ${item.exerciseName} done`}
          aria-pressed={done}
        >
          {done && <Check className="size-5" strokeWidth={3} />}
        </button>
        <Link href={`/gym/exercises/${item.exerciseId}`} className="w-14 shrink-0" aria-label={`${item.exerciseName} details`} tabIndex={-1}>
          <ExerciseAnim id={item.exerciseId} name={item.exerciseName} img={exercise?.img ?? false} animate={false} className="rounded-lg" />
        </Link>
        <button onClick={() => setOpen((v) => !v)} className="min-w-0 flex-1 text-left" aria-expanded={open}>
          <span className={cn("block truncate font-medium", done && "text-text-2")}>{item.exerciseName}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-3">
            <GroupBadge group={group} />
            <span className={cn("tabular", done && "font-medium text-good")}>{now ? now.label : targetLabel(item)}</span>
            {delta !== null && delta !== 0 && (
              <span className={cn("inline-flex items-center gap-0.5 font-medium", delta > 0 ? "text-good" : "text-bad")} title="Compared with last time">
                {delta > 0 ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
                {delta > 0 ? "+" : "−"}
                {Math.abs(delta)} kg
              </span>
            )}
          </span>
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-3 hover:bg-surface-2 hover:text-text"
          aria-label={open ? "Hide details" : "Change sets and weight"}
        >
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="border-t border-border px-3 pt-3 pb-3">
          {prev && previous && (
            <p className="mb-2 text-xs text-text-3">
              Last time ({prettyDay(previous.date, { weekday: undefined })}): {prev.label}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              complete();
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <Num label="Sets" value={form.sets} onChange={(v) => setForm({ ...form, sets: v })} step="1" min={1} />
            {timed ? (
              <Num label="Minutes" value={form.minutes} onChange={(v) => setForm({ ...form, minutes: v })} step="1" min={1} />
            ) : (
              <Num label="Reps" value={form.reps} onChange={(v) => setForm({ ...form, reps: v })} step="1" min={1} />
            )}
            <Num label="Weight (kg)" value={form.weight} onChange={(v) => setForm({ ...form, weight: v })} step="0.5" placeholder="body" />
            <div className="flex gap-1">
              <WeightStep onClick={() => setForm({ ...form, weight: String(Math.max(0, (Number(form.weight) || 0) - 2.5)) })} label="−2.5" />
              <WeightStep onClick={() => setForm({ ...form, weight: String((Number(form.weight) || 0) + 2.5) })} label="+2.5" />
            </div>
            <Button type="submit" variant="primary" disabled={pending} className="h-10 sm:ml-auto">
              <Check className="size-4" /> {done ? "Update" : "Mark done"}
            </Button>
          </form>
          <p className="mt-2 text-xs text-text-3">
            Saving also updates your plan target, so next time starts from this weight. Need different weights per set? Use the{" "}
            <span className="font-medium">Log</span> tab.
          </p>
        </div>
      )}
    </li>
  );
}

function WeightStep({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tabular h-10 rounded-xl border border-border px-2.5 text-xs font-medium text-text-2 hover:bg-surface-2"
      aria-label={`${label} kg`}
    >
      {label}
    </button>
  );
}

function Num({
  label,
  value,
  onChange,
  step,
  min = 0,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step: string;
  min?: number;
  placeholder?: string;
}) {
  return (
    <label className="block w-20">
      <span className="mb-1 block text-xs font-medium text-text-3">{label}</span>
      <Input type="number" inputMode="decimal" min={min} step={step} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/* ------------------------------------------------------------------ Adding & editing */

function AddToPlan({ exercises, plan, sets, onDone }: { exercises: ExerciseLite[]; plan: PlanItem[]; sets: SetRow[]; onDone: () => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<string[]>([]);
  const inPlan = useMemo(() => new Set(plan.map((p) => p.exerciseId)), [plan]);
  const recentIds = useMemo(() => {
    const seen: string[] = [];
    for (let i = sets.length - 1; i >= 0 && seen.length < 12; i--) if (!seen.includes(sets[i].exerciseId)) seen.push(sets[i].exerciseId);
    return seen;
  }, [sets]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-3">Choose a muscle group, then tap every exercise you want in your plan.</p>
      <ExercisePicker
        exercises={exercises}
        recentIds={recentIds}
        selected={picked}
        disabled={inPlan}
        onPick={(id) => setPicked((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]))}
      />
      <div className="sticky bottom-0 flex items-center justify-between gap-3 bg-surface pt-1">
        <span className="text-sm text-text-3">{picked.length ? `${picked.length} selected` : "Nothing selected yet"}</span>
        <Button
          variant="primary"
          disabled={!picked.length || pending}
          onClick={() =>
            start(async () => {
              const res = await addToPlan(picked);
              if (!res.ok) toast(res.error, "bad");
              else {
                toast(`Added ${picked.length} exercise${picked.length > 1 ? "s" : ""} to your plan`);
                onDone();
              }
            })
          }
        >
          <Plus className="size-4" /> Add {picked.length || ""} to plan
        </Button>
      </div>
    </div>
  );
}

function PlanEditor({
  plan,
  byId,
  weekStartsOn,
  onAdd,
}: {
  plan: PlanItem[];
  byId: Map<string, ExerciseLite>;
  weekStartsOn: number;
  onAdd: () => void;
}) {
  const [, start] = useTransition();
  const move = (id: string, dir: -1 | 1) => {
    const ids = plan.map((p) => p.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    start(() => reorderPlan(ids));
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-3">Set the target for each exercise and the days you train it. Tap a day to switch it on or off.</p>
      {plan.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-3">Your plan is empty.</p>
      ) : (
        <ul className="space-y-2">
          {plan.map((p, i) => (
            <PlanEditRow
              key={`${p.id}-${p.sets}-${p.reps}-${p.weight}-${p.durationSec}-${p.daysOfWeek.join()}`}
              item={p}
              exercise={byId.get(p.exerciseId)}
              weekStartsOn={weekStartsOn}
              first={i === 0}
              last={i === plan.length - 1}
              onMove={(dir) => move(p.id, dir)}
            />
          ))}
        </ul>
      )}
      <Button onClick={onAdd} className="w-full">
        <Plus className="size-4" /> Add exercises
      </Button>
    </div>
  );
}

function PlanEditRow({
  item,
  exercise,
  weekStartsOn,
  first,
  last,
  onMove,
}: {
  item: PlanItem;
  exercise?: ExerciseLite;
  weekStartsOn: number;
  first: boolean;
  last: boolean;
  onMove: (dir: -1 | 1) => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const timed = exercise ? isTimed(exercise) : !!item.durationSec;
  const initial = {
    sets: String(item.sets),
    reps: String(item.reps ?? ""),
    weight: String(item.weight ?? ""),
    minutes: String(Math.round((item.durationSec ?? 0) / 60) || ""),
    days: item.daysOfWeek,
  };
  const [v, setV] = useState(initial);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  function save() {
    start(async () => {
      const res = await updatePlanItem(item.id, {
        sets: Math.max(1, Math.round(Number(v.sets) || 1)),
        reps: timed ? null : Math.round(Number(v.reps)) || null,
        weight: v.weight === "" ? null : Number(v.weight),
        durationSec: timed ? Math.round((Number(v.minutes) || 0) * 60) || null : null,
        daysOfWeek: v.days,
      });
      if (!res.ok) toast(res.error, "bad");
    });
  }

  return (
    <li className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.exerciseName}</p>
          <GroupBadge group={exercise ? groupOf(exercise) : undefined} />
        </div>
        <button onClick={() => onMove(-1)} disabled={first} className="flex size-8 items-center justify-center rounded-md text-text-3 hover:text-text disabled:opacity-30" aria-label="Move up">
          <ArrowUp className="size-4" />
        </button>
        <button onClick={() => onMove(1)} disabled={last} className="flex size-8 items-center justify-center rounded-md text-text-3 hover:text-text disabled:opacity-30" aria-label="Move down">
          <ArrowDown className="size-4" />
        </button>
        <button
          onClick={() => {
            if (confirm(`Remove ${item.exerciseName} from your plan? Your logged sets are kept.`)) start(() => removeFromPlan(item.id));
          }}
          className="flex size-8 items-center justify-center rounded-md text-text-3 hover:text-bad"
          aria-label={`Remove ${item.exerciseName} from plan`}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <Num label="Sets" value={v.sets} onChange={(x) => setV({ ...v, sets: x })} step="1" min={1} />
        {timed ? (
          <Num label="Minutes" value={v.minutes} onChange={(x) => setV({ ...v, minutes: x })} step="1" min={1} />
        ) : (
          <Num label="Reps" value={v.reps} onChange={(x) => setV({ ...v, reps: x })} step="1" min={1} />
        )}
        <Num label="Weight (kg)" value={v.weight} onChange={(x) => setV({ ...v, weight: x })} step="0.5" placeholder="body" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1" role="group" aria-label="Training days">
        {weekOrder(weekStartsOn).map((d) => {
          const on = v.days.includes(d);
          return (
            <button
              key={d}
              onClick={() => setV({ ...v, days: on ? v.days.filter((x) => x !== d) : [...v.days, d].sort() })}
              aria-pressed={on}
              aria-label={WEEKDAY_NAMES[d]}
              title={WEEKDAY_NAMES[d]}
              className={cn(
                "size-9 rounded-full text-xs font-medium transition-colors",
                on ? "bg-accent text-accent-fg" : "border border-border text-text-3 hover:bg-surface-2",
              )}
            >
              {WEEKDAYS[d]}
            </button>
          );
        })}
        {dirty && (
          <Button size="sm" variant="primary" onClick={save} disabled={pending || v.days.length === 0} className="ml-auto">
            Save
          </Button>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ Consistency (Progress tab) */

/** Done / missed grid for every plan exercise over the last weeks, plus completion rate. */
export function PlanConsistency({
  plan,
  sets,
  byId,
  today,
}: {
  plan: PlanItem[];
  sets: SetRow[];
  byId: Map<string, ExerciseLite>;
  today: string;
}) {
  const [days, setDays] = useState(14);
  const range = dayRange(addDays(today, -(days - 1)), today);
  const done = useMemo(() => new Set(sets.map((s) => `${s.exerciseId}|${s.date}`)), [sets]);

  const rows = plan.map((p) => {
    let planned = 0;
    let hit = 0;
    for (const d of dayRange(addDays(today, -29), today)) {
      const isDone = done.has(`${p.exerciseId}|${d}`);
      const counts = p.daysOfWeek.includes(dayOfWeek(d)) && d >= p.since && (d < today || isDone);
      if (counts) {
        planned++;
        if (isDone) hit++;
      }
    }
    return { p, rate: planned ? hit / planned : null };
  });

  return (
    <Card className="p-0 sm:p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
        <div>
          <h2 className="text-base font-semibold">Plan check-ins</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-3">
            <span className="inline-flex items-center gap-1">
              <Cell state="done" /> done
            </span>
            <span className="inline-flex items-center gap-1">
              <Cell state="missed" /> missed
            </span>
            <span className="inline-flex items-center gap-1">
              <Cell state="off" /> not planned
            </span>
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5 text-xs" role="radiogroup" aria-label="Days shown">
          {[14, 30].map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={days === n}
              onClick={() => setDays(n)}
              className={cn("rounded-md px-2 py-1", days === n ? "bg-surface font-medium shadow-sm" : "text-text-2")}
            >
              {n}d
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-[11px] text-text-3">
              <th className="sticky left-0 z-10 min-w-36 bg-surface px-4 py-2 text-left text-xs font-medium">Exercise</th>
              {range.map((d) => (
                <th key={d} className={cn("px-0.5 py-2 text-center font-medium", d === today && "text-accent")} title={prettyDay(d)}>
                  <span className="block">{WEEKDAYS[dayOfWeek(d)]}</span>
                  <span className="tabular block">{Number(d.slice(8))}</span>
                </th>
              ))}
              <th className="px-4 py-2 text-right text-xs font-medium whitespace-nowrap">30-day</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, rate }) => {
              const g = byId.get(p.exerciseId);
              return (
                <tr key={p.id} className="group">
                  <td className="sticky left-0 z-10 border-t border-border bg-surface px-4 py-2 group-hover:bg-surface-2">
                    <Link href={`/gym/exercises/${p.exerciseId}`} className="flex items-center gap-2 font-medium hover:underline">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: (g && groupOf(g)?.color) ?? "var(--text-3)" }} aria-hidden />
                      <span className="line-clamp-1">{p.exerciseName}</span>
                    </Link>
                  </td>
                  {range.map((d) => {
                    const isDone = done.has(`${p.exerciseId}|${d}`);
                    const planned = p.daysOfWeek.includes(dayOfWeek(d)) && d >= p.since;
                    const state = isDone ? "done" : planned && d < today ? "missed" : planned ? "today" : "off";
                    return (
                      <td key={d} className="border-t border-border px-0.5 py-2 text-center group-hover:bg-surface-2">
                        <Cell state={state} title={`${prettyDay(d)}: ${state === "today" ? "planned" : state === "off" ? "not planned" : state}`} />
                      </td>
                    );
                  })}
                  <td className="tabular border-t border-border px-4 py-2 text-right group-hover:bg-surface-2">
                    {rate === null ? <span className="text-text-3">–</span> : `${Math.round(rate * 100)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Cell({ state, title }: { state: "done" | "missed" | "today" | "off"; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex size-5 items-center justify-center rounded-md align-middle",
        state === "done" && "bg-good text-white",
        state === "missed" && "bg-bad/15 text-bad",
        state === "today" && "border-2 border-dashed border-border",
        state === "off" && "bg-surface-2",
      )}
    >
      {state === "done" && <Check className="size-3" strokeWidth={3} aria-hidden />}
      {state === "missed" && <X className="size-3" strokeWidth={3} aria-hidden />}
    </span>
  );
}
