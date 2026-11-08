"use client";

import { Archive, CalendarClock, Check, CheckCircle2, Flag, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast";
import { Button, cn, ColorPicker, COLORS, Empty, Input, Label, Modal, Select, Textarea, Fab } from "@/components/ui";
import {
  addMilestone,
  deleteGoal,
  deleteMilestone,
  saveGoal,
  setGoalProgress,
  setGoalStatus,
  toggleMilestone,
} from "@/lib/actions/goals";
import { diffDays, prettyDay } from "@/lib/dates";
import type { Goal, GoalMilestone } from "@/lib/db/schema";

const AREAS = ["Health & fitness", "Career", "Finance", "Learning", "Personal", "Relationships", "Travel", "Creative"];
type Status = "active" | "completed" | "archived";

function progressOf(g: Goal, ms: GoalMilestone[]) {
  if (g.targetValue) return Math.min(1, g.currentValue / g.targetValue);
  if (ms.length) return ms.filter((m) => m.done).length / ms.length;
  return g.status === "completed" ? 1 : 0;
}

const num = (n: number) => (Number.isInteger(n) ? n.toLocaleString() : (Math.round(n * 100) / 100).toLocaleString());

export function GoalsView({ goals, milestones, today }: { goals: Goal[]; milestones: GoalMilestone[]; today: string }) {
  const [status, setStatus] = useState<Status>("active");
  const [area, setArea] = useState("");
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const msOf = (id: string) => milestones.filter((m) => m.goalId === id);
  const count = (s: Status) => goals.filter((g) => g.status === s).length;
  const shown = goals.filter((g) => g.status === status && (!area || g.area === area));
  const areas = [...new Set(goals.map((g) => g.area))];
  const active = goals.filter((g) => g.status === "active");
  const avg = active.length ? active.reduce((s, g) => s + progressOf(g, msOf(g.id)), 0) / active.length : null;
  const doneThisYear = goals.filter((g) => g.status === "completed" && g.completedAt && g.completedAt.getFullYear() === Number(today.slice(0, 4))).length;
  const open = goals.find((g) => g.id === openId) ?? null;

  return (
    <div>
      <PageHeader
        title="Goals"
        sub="Set targets, break them into milestones, and track progress"
        action={
          <Button variant="primary" onClick={() => setEditing("new")} className="max-md:hidden">
            <Plus className="size-4" /> New goal
          </Button>
        }
      />

      {goals.length > 0 && (
        <div className="mb-5 grid grid-cols-3 gap-3">
          <Tile label="Active goals" value={String(active.length)} />
          <Tile label="Average progress" value={avg === null ? "–" : `${Math.round(avg * 100)}%`} />
          <Tile label={`Completed in ${today.slice(0, 4)}`} value={String(doneThisYear)} />
        </div>
      )}

      {goals.length === 0 ? (
        <Empty icon={<Flag className="size-8" />} title="No goals yet">
          Start with something meaningful: “Run 5K”, “Save 500,000 LKR”, “Read 24 books”.
          <div className="mt-3">
            <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-3.5" /> Create a goal
            </Button>
          </div>
        </Empty>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5 text-sm">
              {(["active", "completed", "archived"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  aria-pressed={status === s}
                  className={cn("rounded-md px-3 py-1.5 capitalize", status === s ? "bg-surface font-medium shadow-sm" : "text-text-2")}
                >
                  {s} <span className="text-text-3">{count(s)}</span>
                </button>
              ))}
            </div>
            {areas.length > 1 && (
              <Select value={area} onChange={(e) => setArea(e.target.value)} className="h-9 w-auto" aria-label="Area">
                <option value="">All areas</option>
                {areas.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </Select>
            )}
          </div>
          {shown.length === 0 ? (
            <p className="py-10 text-center text-sm text-text-3">No {status} goals{area ? ` in ${area}` : ""}.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((g) => (
                <GoalCard key={g.id} goal={g} milestones={msOf(g.id)} today={today} onOpen={() => setOpenId(g.id)} />
              ))}
            </div>
          )}
        </>
      )}

      <Fab label="New goal" onClick={() => setEditing("new")} />
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "New goal" : "Edit goal"} wide>
        {editing && <GoalForm goal={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Modal>
      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.title ?? ""} wide>
        {open && (
          <GoalDetail
            goal={open}
            milestones={msOf(open.id)}
            today={today}
            onEdit={() => {
              setOpenId(null);
              setEditing(open);
            }}
            onClose={() => setOpenId(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3 sm:p-4">
      <p className="truncate text-xs font-medium text-text-3">{label}</p>
      <p className="tabular mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl">{value}</p>
    </div>
  );
}

function Ring({ value, color, size = 56 }: { value: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={6} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value)}
        className="transition-[stroke-dashoffset] duration-500"
      />
    </svg>
  );
}

function DueLabel({ goal, today }: { goal: Goal; today: string }) {
  if (!goal.targetDate) return null;
  const days = diffDays(goal.targetDate, today);
  const late = goal.status === "active" && days < 0;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", late ? "text-bad" : days <= 14 && goal.status === "active" ? "text-warn" : "text-text-3")}>
      <CalendarClock className="size-3.5" aria-hidden />
      {goal.status !== "active"
        ? prettyDay(goal.targetDate, { year: "numeric" })
        : late
          ? `${-days} day${days === -1 ? "" : "s"} overdue`
          : days === 0
            ? "Due today"
            : `${days} day${days === 1 ? "" : "s"} left`}
    </span>
  );
}

function GoalCard({ goal, milestones, today, onOpen }: { goal: Goal; milestones: GoalMilestone[]; today: string; onOpen: () => void }) {
  const p = progressOf(goal, milestones);
  const doneMs = milestones.filter((m) => m.done).length;
  return (
    <button
      onClick={onOpen}
      className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-surface p-4 text-left transition-shadow hover:shadow-md"
      style={{ borderTop: `4px solid ${goal.color}` }}
    >
      <div className="flex items-start gap-3">
        <div className="relative">
          <Ring value={p} color={goal.color} />
          <span className="tabular absolute inset-0 flex items-center justify-center text-xs font-semibold">{Math.round(p * 100)}%</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-text-3">{goal.area}</p>
          <h3 className="line-clamp-2 font-semibold">{goal.title}</h3>
        </div>
        {goal.status === "completed" && <CheckCircle2 className="size-5 shrink-0 text-good" aria-label="Completed" />}
      </div>
      {goal.targetValue ? (
        <p className="tabular text-sm text-text-2">
          <span className="font-semibold text-text">{num(goal.currentValue)}</span> / {num(goal.targetValue)} {goal.unit}
        </p>
      ) : null}
      {milestones.length > 0 && (
        <p className="text-sm text-text-2">
          {doneMs}/{milestones.length} milestones
        </p>
      )}
      <div className="mt-auto flex items-center justify-between">
        <DueLabel goal={goal} today={today} />
      </div>
    </button>
  );
}

function GoalDetail({
  goal,
  milestones,
  today,
  onEdit,
  onClose,
}: {
  goal: Goal;
  milestones: GoalMilestone[];
  today: string;
  onEdit: () => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(String(goal.currentValue));
  const [newMs, setNewMs] = useState("");
  const p = progressOf(goal, milestones);

  const updateValue = (v: number) =>
    start(async () => {
      const res = await setGoalProgress(goal.id, Math.max(0, v));
      if (!res.ok) return toast(res.error, "bad");
      setValue(String(Math.max(0, v)));
      if (goal.targetValue && v >= goal.targetValue && goal.status === "active") toast("Goal reached! 🎉");
    });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Ring value={p} color={goal.color} size={72} />
          <span className="tabular absolute inset-0 flex items-center justify-center text-sm font-semibold">{Math.round(p * 100)}%</span>
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-text-3">{goal.area}</p>
          <DueLabel goal={goal} today={today} />
          {goal.status === "completed" && goal.completedAt && (
            <p className="text-xs text-good">Completed {goal.completedAt.toLocaleDateString()}</p>
          )}
        </div>
      </div>
      {goal.description && <p className="text-sm whitespace-pre-wrap text-text-2">{goal.description}</p>}

      {goal.targetValue ? (
        <div className="rounded-xl border border-border p-4">
          <p className="mb-2 text-sm font-medium">
            Progress: {num(goal.currentValue)} / {num(goal.targetValue)} {goal.unit}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateValue(Number(value) || 0);
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <Button type="button" size="icon" onClick={() => updateValue(goal.currentValue - 1)} disabled={pending} aria-label="Decrease by 1">
              −
            </Button>
            <Input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-32"
              aria-label="Current value"
            />
            <Button type="button" size="icon" onClick={() => updateValue(goal.currentValue + 1)} disabled={pending} aria-label="Increase by 1">
              +
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              Update
            </Button>
          </form>
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-semibold">
          Milestones {milestones.length > 0 && <span className="font-normal text-text-3">· {milestones.filter((m) => m.done).length}/{milestones.length}</span>}
        </h3>
        <ul className="space-y-1">
          {milestones.map((m) => (
            <li key={m.id} className="group flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-surface-2">
              <button
                onClick={() => start(() => toggleMilestone(m.id, !m.done))}
                className="flex size-5 shrink-0 items-center justify-center rounded-md border-2"
                style={m.done ? { background: goal.color, borderColor: goal.color } : { borderColor: "var(--text-3)" }}
                aria-pressed={m.done}
                aria-label={m.done ? `Mark "${m.title}" not done` : `Mark "${m.title}" done`}
              >
                {m.done && <Check className="size-3 text-white" strokeWidth={3} />}
              </button>
              <span className={cn("flex-1 text-sm", m.done && "text-text-3 line-through")}>{m.title}</span>
              <button
                onClick={() => start(() => deleteMilestone(m.id))}
                className="flex size-9 shrink-0 items-center justify-center rounded-md text-text-3 hover:text-bad active:bg-surface-2 can-hover:size-7 can-hover:opacity-0 can-hover:group-hover:opacity-100"
                aria-label={`Delete milestone ${m.title}`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = newMs.trim();
            if (!t) return;
            setNewMs("");
            start(async () => {
              const res = await addMilestone(goal.id, t);
              if (!res.ok) toast(res.error, "bad");
            });
          }}
          className="mt-2 flex gap-2"
        >
          <Input value={newMs} onChange={(e) => setNewMs(e.target.value)} placeholder="Add a milestone" maxLength={200} className="h-9" />
          <Button type="submit" size="sm" disabled={!newMs.trim()}>
            <Plus className="size-4" />
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button size="sm" onClick={onEdit}>
          <Pencil className="size-4" /> Edit
        </Button>
        {goal.status === "active" ? (
          <>
            <Button size="sm" onClick={() => start(async () => (await setGoalStatus(goal.id, "completed"), toast("Goal completed 🎉")))}>
              <CheckCircle2 className="size-4" /> Mark complete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => start(async () => (await setGoalStatus(goal.id, "archived"), onClose()))}>
              <Archive className="size-4" /> Archive
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => start(() => setGoalStatus(goal.id, "active"))}>
            <RotateCcw className="size-4" /> Reopen
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto hover:text-bad"
          onClick={() => {
            if (!confirm(`Delete "${goal.title}"? This can't be undone.`)) return;
            start(async () => {
              await deleteGoal(goal.id);
              toast("Goal deleted");
              onClose();
            });
          }}
        >
          <Trash2 className="size-4" /> Delete
        </Button>
      </div>
    </div>
  );
}

function GoalForm({ goal, onDone }: { goal: Goal | null; onDone: () => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(goal?.title ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [area, setArea] = useState(goal?.area ?? AREAS[0]);
  const [color, setColor] = useState(goal?.color ?? COLORS[0]);
  const [measurable, setMeasurable] = useState(goal ? goal.targetValue !== null : false);
  const [target, setTarget] = useState(goal?.targetValue ? String(goal.targetValue) : "");
  const [current, setCurrent] = useState(goal ? String(goal.currentValue) : "0");
  const [unit, setUnit] = useState(goal?.unit ?? "");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  const [milestones, setMilestones] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await saveGoal(
            goal?.id ?? null,
            {
              title,
              description: description || null,
              area,
              color,
              targetValue: measurable && target ? Number(target) : null,
              currentValue: measurable ? Number(current) || 0 : (goal?.currentValue ?? 0),
              unit: measurable ? unit || null : null,
              targetDate: targetDate || null,
            },
            goal ? [] : milestones.split("\n"),
          );
          if (!res.ok) return setError(res.error);
          toast(goal ? "Goal updated" : "Goal created");
          onDone();
        });
      }}
      className="space-y-4"
    >
      <label className="block">
        <Label>Goal</Label>
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Run a half marathon" required maxLength={150} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <Label>Area</Label>
          <Select value={area} onChange={(e) => setArea(e.target.value)}>
            {[...new Set([...AREAS, area])].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </label>
        <label className="block">
          <Label hint="optional">Target date</Label>
          <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </label>
      </div>
      <label className="block">
        <Label hint="optional">Why it matters / details</Label>
        <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
      </label>

      <div className="rounded-xl border border-border p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={measurable} onChange={(e) => setMeasurable(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Track a number (e.g. kg lost, money saved, books read)
        </label>
        {measurable && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <label className="block">
              <Label>Current</Label>
              <Input type="number" min={0} step="any" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </label>
            <label className="block">
              <Label>Target</Label>
              <Input type="number" min={0} step="any" value={target} onChange={(e) => setTarget(e.target.value)} required />
            </label>
            <label className="block">
              <Label>Unit</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="km, LKR…" maxLength={30} />
            </label>
          </div>
        )}
      </div>

      {!goal && (
        <label className="block">
          <Label hint="one per line, optional">Milestones</Label>
          <Textarea
            rows={3}
            value={milestones}
            onChange={(e) => setMilestones(e.target.value)}
            placeholder={"Run 5K without stopping\nRun 10K\nSign up for the race"}
          />
        </label>
      )}
      <div>
        <Label>Colour</Label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      {error && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : goal ? "Save" : "Create goal"}
        </Button>
      </div>
    </form>
  );
}
