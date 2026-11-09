"use client";

import { ChevronLeft, ChevronRight, Dumbbell, History, Plus, Search, Trash2, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExerciseAnim } from "@/components/exercise-anim";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast";
import { Button, Card, CardTitle, cn, Empty, Input, Modal, Select } from "@/components/ui";
import { addSet, deleteSet, removeExerciseFromDay } from "@/lib/actions/gym";
import { addDays, prettyDay, relativeDayLabel, startOfWeek } from "@/lib/dates";
import {
  capitalize,
  estimate1RM,
  EXERCISE_TYPES,
  groupOf,
  isTimed,
  MUSCLE_GROUPS,
  type ExerciseLite,
  type MuscleGroup,
} from "@/lib/gym/groups";
import { weekChange, weeklyStats, type WeekStat } from "@/lib/gym/weekly";

export type SetRow = {
  id: string;
  date: string;
  exerciseId: string;
  exerciseName: string;
  reps: number | null;
  weight: number | null;
  durationSec: number | null;
};

type Tab = "workout" | "exercises" | "progress";

export const fmtKg = (n: number) => `${Math.round(n * 10) / 10} kg`;
export const fmtDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
export const fmtVolume = (kg: number) => (kg >= 10_000 ? `${(kg / 1000).toFixed(1)} t` : `${Math.round(kg).toLocaleString()} kg`);

export function setLabel(s: Pick<SetRow, "reps" | "weight" | "durationSec">) {
  if (s.durationSec) return fmtDuration(s.durationSec) + (s.weight ? ` · ${fmtKg(s.weight)}` : "");
  return `${s.reps ?? 0} reps` + (s.weight ? ` × ${fmtKg(s.weight)}` : "");
}

export function GymView({
  exercises,
  sets,
  today,
  weekStartsOn,
}: {
  exercises: ExerciseLite[];
  sets: SetRow[];
  today: string;
  weekStartsOn: number;
}) {
  const [tab, setTab] = useState<Tab>("workout");
  const [date, setDate] = useState(today);
  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const trainedToday = sets.some((s) => s.date === today);

  return (
    <div>
      <PageHeader
        title="Gym"
        sub={trainedToday ? "Nice work, you trained today 💪" : "Log your workout and track your strength"}
        action={
          <div className="flex w-full rounded-xl border border-border bg-surface-2 p-1 text-sm sm:inline-flex sm:w-auto sm:rounded-lg sm:p-0.5" role="tablist">
            {(
              [
                ["workout", "Workout"],
                ["exercises", "Exercises"],
                ["progress", "Progress"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cn("flex-1 rounded-lg px-3 py-2 sm:flex-none sm:rounded-md sm:py-1.5", tab === k ? "bg-surface font-medium shadow-sm" : "text-text-2")}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />
      {tab === "workout" && (
        <WorkoutTab
          key={date}
          date={date}
          setDate={setDate}
          today={today}
          sets={sets}
          byId={byId}
          exercises={exercises}
        />
      )}
      {tab === "exercises" && <ExercisesTab exercises={exercises} />}
      {tab === "progress" && (
        <ProgressTab
          sets={sets}
          byId={byId}
          today={today}
          weekStartsOn={weekStartsOn}
          openDay={(d) => {
            setDate(d);
            setTab("workout");
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Workout */

function WorkoutTab({
  date,
  setDate,
  today,
  sets,
  byId,
  exercises,
}: {
  date: string;
  setDate: (d: string) => void;
  today: string;
  sets: SetRow[];
  byId: Map<string, ExerciseLite>;
  exercises: ExerciseLite[];
}) {
  const [extra, setExtra] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const daySets = sets.filter((s) => s.date === date);
  const order = [...new Set([...daySets.map((s) => s.exerciseId), ...extra])];
  const volume = daySets.reduce((v, s) => v + (s.reps ?? 0) * (s.weight ?? 0), 0);
  const recentIds = useMemo(() => {
    const seen: string[] = [];
    for (let i = sets.length - 1; i >= 0 && seen.length < 12; i--) if (!seen.includes(sets[i].exerciseId)) seen.push(sets[i].exerciseId);
    return seen;
  }, [sets]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
            aria-label="Workout date"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDate(addDays(date, 1))}
            disabled={date >= today}
            aria-label="Next day"
          >
            <ChevronRight className="size-4" />
          </Button>
          <span className="ml-1 text-sm font-medium text-text-2">{relativeDayLabel(date, today)}</span>
        </div>
        <Button variant="primary" onClick={() => setPicking(true)}>
          <Plus className="size-4" /> Add exercise
        </Button>
      </div>

      {daySets.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Exercises" value={String(new Set(daySets.map((s) => s.exerciseId)).size)} />
          <Stat label="Sets" value={String(daySets.length)} />
          <Stat label="Volume" value={volume ? fmtVolume(volume) : "–"} />
        </div>
      )}

      {order.length === 0 ? (
        <Empty icon={<Dumbbell className="size-8" />} title={date === today ? "No workout logged today" : "No workout on this day"}>
          Tap <span className="font-medium text-text-2">Add exercise</span> to pick from 870+ exercises by muscle group.
        </Empty>
      ) : (
        order.map((id) => (
          <ExerciseBlock
            key={id}
            exercise={byId.get(id)}
            exerciseId={id}
            fallbackName={daySets.find((s) => s.exerciseId === id)?.exerciseName ?? id}
            date={date}
            sets={daySets.filter((s) => s.exerciseId === id)}
            previous={lastSession(sets, id, date)}
            onRemoveEmpty={() => setExtra((x) => x.filter((e) => e !== id))}
          />
        ))
      )}

      <Modal open={picking} onClose={() => setPicking(false)} title="Add exercise" wide>
        <ExercisePicker
          exercises={exercises}
          recentIds={recentIds}
          onPick={(id) => {
            setExtra((x) => (x.includes(id) ? x : [...x, id]));
            setPicking(false);
          }}
        />
      </Modal>
    </div>
  );
}

function lastSession(sets: SetRow[], exerciseId: string, before: string) {
  let d: string | null = null;
  for (let i = sets.length - 1; i >= 0; i--) {
    const s = sets[i];
    if (s.exerciseId === exerciseId && s.date < before) {
      d = s.date;
      break;
    }
  }
  return d ? { date: d, sets: sets.filter((s) => s.exerciseId === exerciseId && s.date === d) } : null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface shadow-card p-3 sm:p-4">
      <p className="text-xs font-medium text-text-3">{label}</p>
      <p className="tabular mt-0.5 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function GroupBadge({ group }: { group?: MuscleGroup }) {
  if (!group) return null;
  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium"
      style={{ background: `${group.color}1f`, color: group.color }}
    >
      {group.label}
    </span>
  );
}

function ExerciseBlock({
  exercise,
  exerciseId,
  fallbackName,
  date,
  sets,
  previous,
  onRemoveEmpty,
}: {
  exercise?: ExerciseLite;
  exerciseId: string;
  fallbackName: string;
  date: string;
  sets: SetRow[];
  previous: { date: string; sets: SetRow[] } | null;
  onRemoveEmpty: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const timed = exercise ? isTimed(exercise) : false;
  const name = exercise?.name ?? fallbackName;
  const seed = sets[sets.length - 1] ?? previous?.sets[previous.sets.length - 1];
  const [reps, setReps] = useState(seed?.reps ? String(seed.reps) : "");
  const [weight, setWeight] = useState(seed?.weight ? String(seed.weight) : "");
  const [minutes, setMinutes] = useState(seed?.durationSec ? String(Math.floor(seed.durationSec / 60)) : "");
  const [seconds, setSeconds] = useState(seed?.durationSec ? String(seed.durationSec % 60) : "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const w = weight ? Number(weight) : null;
    const input = timed
      ? { durationSec: (Number(minutes) || 0) * 60 + (Number(seconds) || 0), weight: w }
      : { reps: reps ? Math.round(Number(reps)) : null, weight: w };
    start(async () => {
      const res = await addSet(date, exerciseId, input);
      if (!res.ok) toast(res.error, "bad");
    });
  }

  function remove() {
    if (!sets.length) return onRemoveEmpty();
    if (!confirm(`Remove ${name} and its ${sets.length} set${sets.length > 1 ? "s" : ""} from this workout?`)) return;
    start(async () => {
      await removeExerciseFromDay(date, exerciseId);
      onRemoveEmpty();
    });
  }

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex gap-3">
        <Link href={`/gym/exercises/${exerciseId}`} className="w-24 shrink-0 sm:w-28" aria-label={`${name} details`}>
          <ExerciseAnim id={exerciseId} name={name} img={exercise?.img ?? false} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link href={`/gym/exercises/${exerciseId}`} className="font-semibold hover:underline">
                {name}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-text-3">
                <GroupBadge group={exercise ? groupOf(exercise) : undefined} />
                {exercise && <span>{capitalize(exercise.equipment)}</span>}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={remove} disabled={pending} aria-label={`Remove ${name}`}>
              <Trash2 className="size-4" />
            </Button>
          </div>
          {previous && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-text-3">
              <History className="size-3" aria-hidden />
              Last time ({prettyDay(previous.date, { weekday: undefined })}): {previous.sets.map((s) => setLabel(s)).join(", ")}
            </p>
          )}
        </div>
      </div>

      {sets.length > 0 && (
        <ol className="mt-3 divide-y divide-border rounded-xl border border-border">
          {sets.map((s, i) => (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-12 text-xs font-medium text-text-3">Set {i + 1}</span>
              <span className="tabular flex-1 font-medium">{setLabel(s)}</span>
              {!timed && s.weight && s.reps ? (
                <span className="tabular hidden text-xs text-text-3 sm:inline">1RM ≈ {fmtKg(estimate1RM(s.weight, s.reps))}</span>
              ) : null}
              <button
                className="rounded-md p-1 text-text-3 hover:bg-surface-2 hover:text-bad"
                onClick={() => start(() => deleteSet(s.id))}
                aria-label={`Delete set ${i + 1}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
        {timed ? (
          <>
            <NumField label="Min" value={minutes} onChange={setMinutes} step="1" />
            <NumField label="Sec" value={seconds} onChange={setSeconds} step="1" max={59} />
          </>
        ) : (
          <NumField label="Reps" value={reps} onChange={setReps} step="1" />
        )}
        <NumField label="Weight (kg)" value={weight} onChange={setWeight} step="0.5" placeholder="body" />
        <Button type="submit" variant="primary" disabled={pending} className="h-10">
          <Plus className="size-4" /> Add set
        </Button>
      </form>
    </Card>
  );
}

function NumField({
  label,
  value,
  onChange,
  step,
  max,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step: string;
  max?: number;
  placeholder?: string;
}) {
  return (
    <label className="block w-24">
      <span className="mb-1 block text-xs font-medium text-text-3">{label}</span>
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        max={max}
        step={step}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/* ------------------------------------------------------------------ Picker & library */

function useFilteredExercises(exercises: ExerciseLite[]) {
  const [group, setGroup] = useState<string>("all");
  const [q, setQ] = useState("");
  const [equipment, setEquipment] = useState("");
  const [type, setType] = useState("");
  const [level, setLevel] = useState("");
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of exercises) {
      const g = groupOf(e);
      if (g) m.set(g.key, (m.get(g.key) ?? 0) + 1);
    }
    return m;
  }, [exercises]);
  const equipmentList = useMemo(() => [...new Set(exercises.map((e) => e.equipment))].sort(), [exercises]);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = exercises.filter(
    (e) =>
      (group === "all" || groupOf(e)?.key === group) &&
      (!equipment || e.equipment === equipment) &&
      (!type || e.category === type) &&
      (!level || e.level === level) &&
      words.every((w) => e.name.toLowerCase().includes(w)),
  );
  return { group, setGroup, q, setQ, equipment, setEquipment, type, setType, level, setLevel, counts, equipmentList, list };
}

function GroupChips({
  group,
  setGroup,
  counts,
  extra,
}: {
  group: string;
  setGroup: (g: string) => void;
  counts: Map<string, number>;
  extra?: { key: string; label: string }[];
}) {
  const chips = [...(extra ?? []), { key: "all", label: "All" }, ...MUSCLE_GROUPS];
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Muscle group">
      {chips.map((g) => {
        const color = "color" in g ? (g as MuscleGroup).color : undefined;
        const active = group === g.key;
        return (
          <button
            key={g.key}
            role="radio"
            aria-checked={active}
            onClick={() => setGroup(g.key)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
              active ? "border-transparent bg-accent text-accent-fg" : "border-border bg-surface text-text-2 hover:bg-surface-2",
            )}
          >
            {color && <span className="size-2 rounded-full" style={{ background: active ? "currentColor" : color }} aria-hidden />}
            {g.label}
            {counts.has(g.key) && <span className={cn("text-xs", active ? "opacity-80" : "text-text-3")}>{counts.get(g.key)}</span>}
          </button>
        );
      })}
    </div>
  );
}

function ExercisePicker({
  exercises,
  recentIds,
  onPick,
}: {
  exercises: ExerciseLite[];
  recentIds: string[];
  onPick: (id: string) => void;
}) {
  const f = useFilteredExercises(exercises);
  const [initial] = useState(recentIds.length ? "recent" : "all");
  const [mode, setMode] = useState(initial);
  const group = mode === "recent" ? "recent" : f.group;
  const recent = recentIds.map((id) => exercises.find((e) => e.id === id)).filter(Boolean) as ExerciseLite[];
  const list = mode === "recent" && !f.q ? recent : f.list;
  const shown = list.slice(0, 60);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-3" aria-hidden />
        <Input
          autoFocus
          value={f.q}
          onChange={(e) => {
            f.setQ(e.target.value);
            if (mode === "recent") setMode("all");
          }}
          placeholder="Search exercises, e.g. bench press"
          className="pl-9"
        />
      </div>
      <GroupChips
        group={group}
        setGroup={(g) => {
          setMode(g === "recent" ? "recent" : "group");
          if (g !== "recent") f.setGroup(g);
        }}
        counts={f.counts}
        extra={recent.length ? [{ key: "recent", label: "Recent" }] : undefined}
      />
      <ul className="max-h-[55dvh] divide-y divide-border overflow-y-auto rounded-xl border border-border">
        {shown.map((e) => (
          <li key={e.id}>
            <button onClick={() => onPick(e.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2">
              <ExerciseAnim id={e.id} name={e.name} img={e.img} animate={false} className="w-16 shrink-0 rounded-lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{e.name}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-text-3">
                  <GroupBadge group={groupOf(e)} /> {capitalize(e.equipment)}
                </span>
              </span>
              <Plus className="size-4 text-text-3" aria-hidden />
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="px-3 py-8 text-center text-sm text-text-3">No exercises match.</li>}
      </ul>
      {list.length > shown.length && (
        <p className="text-center text-xs text-text-3">
          Showing {shown.length} of {list.length}. Search to narrow down.
        </p>
      )}
    </div>
  );
}

function ExercisesTab({ exercises }: { exercises: ExerciseLite[] }) {
  const f = useFilteredExercises(exercises);
  const [limit, setLimit] = useState(24);
  const reset = () => setLimit(24);

  return (
    <div className="space-y-4">
      <GroupChips
        group={f.group}
        setGroup={(g) => {
          f.setGroup(g);
          reset();
        }}
        counts={f.counts}
      />
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-3" aria-hidden />
          <Input
            value={f.q}
            onChange={(e) => {
              f.setQ(e.target.value);
              reset();
            }}
            placeholder="Search exercises"
            className="pl-9"
            aria-label="Search exercises"
          />
        </div>
        <Select value={f.equipment} onChange={(e) => (f.setEquipment(e.target.value), reset())} aria-label="Equipment">
          <option value="">Any equipment</option>
          {f.equipmentList.map((x) => (
            <option key={x} value={x}>
              {capitalize(x)}
            </option>
          ))}
        </Select>
        <Select value={f.type} onChange={(e) => (f.setType(e.target.value), reset())} aria-label="Type">
          <option value="">Any type</option>
          {EXERCISE_TYPES.map((x) => (
            <option key={x} value={x}>
              {capitalize(x)}
            </option>
          ))}
        </Select>
        <Select value={f.level} onChange={(e) => (f.setLevel(e.target.value), reset())} aria-label="Level">
          <option value="">Any level</option>
          {["beginner", "intermediate", "expert"].map((x) => (
            <option key={x} value={x}>
              {capitalize(x)}
            </option>
          ))}
        </Select>
      </div>
      <p className="text-sm text-text-3">{f.list.length} exercises</p>
      {f.list.length === 0 ? (
        <Empty icon={<Search className="size-8" />} title="No exercises match">
          Try another muscle group or clear the filters.
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {f.list.slice(0, limit).map((e) => (
            <Link
              key={e.id}
              href={`/gym/exercises/${e.id}`}
              className="group rounded-2xl border border-border bg-surface shadow-card p-2 transition-shadow hover:shadow-md"
            >
              <ExerciseAnim id={e.id} name={e.name} img={e.img} />
              <div className="px-1 pt-2 pb-1">
                <p className="line-clamp-2 text-sm font-medium group-hover:underline">{e.name}</p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-text-3">
                  <GroupBadge group={groupOf(e)} />
                  {capitalize(e.equipment)} · {capitalize(e.level)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
      {f.list.length > limit && (
        <div className="flex justify-center">
          <Button onClick={() => setLimit((l) => l + 24)}>Show more</Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Weekly weights */

function ChangeBadge({ delta, unit = "kg" }: { delta: number | null; unit?: string }) {
  if (delta === null || delta === 0) return null;
  const up = delta > 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-medium", up ? "text-good" : "text-bad")}>
      {up ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
      {up ? "+" : "−"}
      {Math.abs(delta)}
      {unit && ` ${unit}`}
    </span>
  );
}

/** One row per exercise, one column per week: the heaviest weight lifted that week. */
function WeeklyWeights({
  sets,
  byId,
  today,
  weekStartsOn,
}: {
  sets: SetRow[];
  byId: Map<string, ExerciseLite>;
  today: string;
  weekStartsOn: number;
}) {
  const [weeks, setWeeks] = useState(8);
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const from = addDays(startOfWeek(today, weekStartsOn), -7 * (weeks - 1));
    const inWindow = sets.filter((s) => s.date >= from);
    const ids = [...new Set(inWindow.map((s) => s.exerciseId))];
    return ids
      .map((id) => {
        const exSets = inWindow.filter((s) => s.exerciseId === id);
        const stats = weeklyStats(exSets, weekStartsOn, today, weeks);
        const withWeight = stats.filter((w) => w.topWeight !== null);
        const total = withWeight.length >= 2 ? withWeight[withWeight.length - 1].topWeight! - withWeight[0].topWeight! : null;
        return {
          id,
          name: exSets[0].exerciseName,
          group: byId.get(id) ? groupOf(byId.get(id)!) : undefined,
          last: exSets[exSets.length - 1].date,
          stats,
          total: total === null ? null : Math.round(total * 10) / 10,
        };
      })
      .sort((a, b) => b.last.localeCompare(a.last));
  }, [sets, byId, today, weekStartsOn, weeks]);

  const text = q.toLowerCase();
  const shown = rows.filter((r) => !text || r.name.toLowerCase().includes(text));
  const weekCols = rows[0]?.stats.map((w) => w.week) ?? weeklyStats([], weekStartsOn, today, weeks).map((w) => w.week);
  const thisWeek = startOfWeek(today, weekStartsOn);

  return (
    <Card className="p-0 sm:p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
        <div>
          <h2 className="text-base font-semibold">Weekly weights</h2>
          <p className="mt-0.5 text-xs text-text-3">Heaviest weight (kg) × reps per exercise each week. Arrows compare with your previous week.</p>
        </div>
        <div className="flex items-center gap-2">
          {rows.length > 6 && (
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" className="h-8 w-32" aria-label="Filter exercises" />
          )}
          <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5 text-xs" role="radiogroup" aria-label="Weeks shown">
            {[8, 12, 26].map((n) => (
              <button
                key={n}
                role="radio"
                aria-checked={weeks === n}
                onClick={() => setWeeks(n)}
                className={cn("rounded-md px-2 py-1", weeks === n ? "bg-surface font-medium shadow-sm" : "text-text-2")}
              >
                {n}w
              </button>
            ))}
          </div>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-text-3">No sets in the last {weeks} weeks.</p>
      ) : (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-xs text-text-3">
                <th className="sticky left-0 z-10 min-w-40 bg-surface px-4 py-2 text-left font-medium">Exercise</th>
                {weekCols.map((w) => (
                  <th key={w} className={cn("min-w-20 px-2 py-2 text-center font-medium whitespace-nowrap", w === thisWeek && "text-accent")}>
                    {w === thisWeek ? "This wk" : prettyDay(w, { weekday: undefined })}
                  </th>
                ))}
                <th className="min-w-20 px-4 py-2 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="group">
                  <td className="sticky left-0 z-10 border-t border-border bg-surface px-4 py-2 group-hover:bg-surface-2">
                    <Link href={`/gym/exercises/${r.id}`} className="flex items-center gap-2 font-medium hover:underline">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: r.group?.color ?? "var(--text-3)" }} aria-hidden />
                      <span className="line-clamp-2">{r.name}</span>
                    </Link>
                  </td>
                  {r.stats.map((w, i) => (
                    <td key={w.week} className="border-t border-border px-2 py-2 text-center group-hover:bg-surface-2">
                      <WeekCell w={w} delta={weekChange(r.stats, i)} />
                    </td>
                  ))}
                  <td className="border-t border-border px-4 py-2 text-right group-hover:bg-surface-2">
                    {r.total === null ? <span className="text-text-3">–</span> : r.total === 0 ? <span className="text-xs text-text-3">same</span> : <ChangeBadge delta={r.total} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function WeekCell({ w, delta }: { w: WeekStat; delta: number | null }) {
  if (!w.sets) return <span className="text-text-3">–</span>;
  const title = `${w.sessions} session${w.sessions === 1 ? "" : "s"}, ${w.sets} set${w.sets === 1 ? "" : "s"}${w.volume ? `, ${Math.round(w.volume).toLocaleString()} kg volume` : ""}`;
  if (w.topWeight !== null) {
    return (
      <span className="inline-flex flex-col items-center leading-tight" title={title}>
        <span className="tabular font-semibold">
          {Math.round(w.topWeight * 10) / 10}
          {w.topReps ? <span className="text-xs font-normal text-text-3">×{w.topReps}</span> : null}
        </span>
        <ChangeBadge delta={delta} unit="" />
      </span>
    );
  }
  if (w.maxReps) {
    return (
      <span className="tabular text-text-2" title={title}>
        {w.maxReps} reps
      </span>
    );
  }
  return (
    <span className="tabular text-text-2" title={title}>
      {fmtDuration(w.duration)}
    </span>
  );
}

/* ------------------------------------------------------------------ Progress */

function ProgressTab({
  sets,
  byId,
  today,
  weekStartsOn,
  openDay,
}: {
  sets: SetRow[];
  byId: Map<string, ExerciseLite>;
  today: string;
  weekStartsOn: number;
  openDay: (d: string) => void;
}) {
  const stats = useMemo(() => {
    const vol = (s: SetRow) => (s.reps ?? 0) * (s.weight ?? 0);
    const monthAgo = addDays(today, -29);
    const recent = sets.filter((s) => s.date >= monthAgo);
    const days = [...new Set(sets.map((s) => s.date))].sort().reverse();
    const thisWeekStart = startOfWeek(today, weekStartsOn);

    const weekly = Array.from({ length: 12 }, (_, i) => {
      const w = addDays(thisWeekStart, -7 * (11 - i));
      const end = addDays(w, 6);
      const ws = sets.filter((s) => s.date >= w && s.date <= end);
      return { label: w.slice(5), volume: Math.round(ws.reduce((v, s) => v + vol(s), 0)), days: new Set(ws.map((s) => s.date)).size };
    });

    const split = new Map<string, number>();
    for (const s of recent) {
      const g = byId.get(s.exerciseId);
      const key = g ? groupOf(g)?.key : undefined;
      if (key) split.set(key, (split.get(key) ?? 0) + 1);
    }

    const prs = new Map<string, { id: string; name: string; best: SetRow; oneRm: number; last: string }>();
    for (const s of sets) {
      if (!s.weight || !s.reps) continue;
      const cur = prs.get(s.exerciseId);
      const oneRm = estimate1RM(s.weight, s.reps);
      if (!cur) prs.set(s.exerciseId, { id: s.exerciseId, name: s.exerciseName, best: s, oneRm, last: s.date });
      else {
        if (s.weight > cur.best.weight! || (s.weight === cur.best.weight && s.reps > cur.best.reps!)) cur.best = s;
        cur.oneRm = Math.max(cur.oneRm, oneRm);
        cur.last = s.date > cur.last ? s.date : cur.last;
      }
    }

    return {
      weekDays: days.filter((d) => d >= thisWeekStart).length,
      monthDays: new Set(recent.map((s) => s.date)).size,
      monthSets: recent.length,
      monthVolume: recent.reduce((v, s) => v + vol(s), 0),
      weekly,
      split: MUSCLE_GROUPS.map((g) => ({ g, n: split.get(g.key) ?? 0 })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n),
      prs: [...prs.values()].sort((a, b) => b.last.localeCompare(a.last)).slice(0, 12),
      sessions: days.slice(0, 10).map((d) => {
        const ds = sets.filter((s) => s.date === d);
        return { date: d, names: [...new Set(ds.map((s) => s.exerciseName))], sets: ds.length };
      }),
    };
  }, [sets, byId, today, weekStartsOn]);

  if (!sets.length) {
    return (
      <Empty icon={<Trophy className="size-8" />} title="No workouts yet">
        Log your first workout and your progress, personal records and muscle split will show up here.
      </Empty>
    );
  }
  const maxSplit = stats.split[0]?.n ?? 1;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Workouts this week" value={String(stats.weekDays)} />
        <Stat label="Workouts (30 days)" value={String(stats.monthDays)} />
        <Stat label="Sets (30 days)" value={String(stats.monthSets)} />
        <Stat label="Volume (30 days)" value={stats.monthVolume ? fmtVolume(stats.monthVolume) : "–"} />
      </div>

      <WeeklyWeights sets={sets} byId={byId} today={today} weekStartsOn={weekStartsOn} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle sub="Total kg lifted (reps × weight) per week">Weekly volume</CardTitle>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.weekly} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-3)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-3)" }} tickLine={false} axisLine={false} width={48} />
                <Tooltip
                  cursor={{ fill: "var(--surface-2)" }}
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(l) => `Week of ${l}`}
                  formatter={(v, _n, p) => [`${Number(v).toLocaleString()} kg · ${p.payload.days} workout${p.payload.days === 1 ? "" : "s"}`, "Volume"]}
                />
                <Bar dataKey="volume" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardTitle sub="Sets per muscle group, last 30 days">Muscle split</CardTitle>
          {stats.split.length === 0 ? (
            <p className="text-sm text-text-3">No sets in the last 30 days.</p>
          ) : (
            <ul className="space-y-2.5">
              {stats.split.map(({ g, n }) => (
                <li key={g.key}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{g.label}</span>
                    <span className="tabular text-text-3">{n}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${(n / maxSplit) * 100}%`, background: g.color }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle sub="Heaviest set and estimated one-rep max">Personal records</CardTitle>
          {stats.prs.length === 0 ? (
            <p className="text-sm text-text-3">Log weighted sets to see your records.</p>
          ) : (
            <ul className="divide-y divide-border">
              {stats.prs.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <Trophy className="size-4 shrink-0 text-warn" aria-hidden />
                  <Link href={`/gym/exercises/${p.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                    {p.name}
                  </Link>
                  <span className="tabular text-sm">{setLabel(p.best)}</span>
                  <span className="tabular hidden w-24 text-right text-xs text-text-3 sm:inline">1RM {fmtKg(p.oneRm)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle sub="Tap a session to open it">Recent workouts</CardTitle>
          <ul className="divide-y divide-border">
            {stats.sessions.map((s) => (
              <li key={s.date}>
                <button onClick={() => openDay(s.date)} className="flex w-full items-center gap-3 py-2 text-left hover:bg-surface-2">
                  <span className="w-24 shrink-0 text-sm font-medium">{relativeDayLabel(s.date, today)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-text-2">{s.names.join(", ")}</span>
                  <span className="tabular text-xs text-text-3">{s.sets} sets</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
