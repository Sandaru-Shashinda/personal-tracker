"use client";

import { Plus, Trash2, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { useState, useTransition } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useToast } from "@/components/toast";
import { Button, Card, CardTitle, cn, Input } from "@/components/ui";
import { addSet, deleteSet } from "@/lib/actions/gym";
import { prettyDay, relativeDayLabel } from "@/lib/dates";
import { estimate1RM, isTimed } from "@/lib/gym/groups";
import { weekChange, weeklyStats, weeksSince } from "@/lib/gym/weekly";
import { fmtKg, setLabel, type SetRow } from "../../gym-view";

export function ExerciseLog({
  exercise,
  sets,
  today,
  weekStartsOn,
}: {
  exercise: { id: string; name: string; category: string };
  sets: SetRow[];
  today: string;
  weekStartsOn: number;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const timed = isTimed(exercise);
  const last = sets[sets.length - 1];
  const [reps, setReps] = useState(last?.reps ? String(last.reps) : "");
  const [weight, setWeight] = useState(last?.weight ? String(last.weight) : "");
  const [minutes, setMinutes] = useState(last?.durationSec ? String(Math.floor(last.durationSec / 60)) : "");

  const todaySets = sets.filter((s) => s.date === today);
  const sessions = [...new Set(sets.map((s) => s.date))].reverse();
  const weighted = sets.filter((s) => s.weight && s.reps);
  const best = weighted.reduce<SetRow | null>(
    (b, s) => (!b || s.weight! > b.weight! || (s.weight === b.weight && s.reps! > b.reps!) ? s : b),
    null,
  );
  const best1RM = weighted.reduce((m, s) => Math.max(m, estimate1RM(s.weight!, s.reps!)), 0);
  // Week-by-week, from the first week this exercise was logged (up to a year).
  const weekly = weeklyStats(sets, weekStartsOn, today, weeksSince(sets[0]?.date, today, weekStartsOn));
  const thisWeek = weekly[weekly.length - 1]?.week;
  const chart = weekly.map((w) => ({
    label: prettyDay(w.week, { weekday: undefined }),
    best: w.topWeight,
    oneRm: w.best1RM === null ? null : Math.round(w.best1RM * 10) / 10,
  }));
  const loggedWeeks = weekly.map((w, i) => ({ w, delta: weekChange(weekly, i) })).filter(({ w }) => w.sets > 0).reverse();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const w = weight ? Number(weight) : null;
    start(async () => {
      const res = await addSet(
        today,
        exercise.id,
        timed ? { durationSec: Math.round((Number(minutes) || 0) * 60), weight: w } : { reps: Math.round(Number(reps)) || null, weight: w },
      );
      if (!res.ok) toast(res.error, "bad");
      else toast("Set logged");
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle sub={todaySets.length ? `${todaySets.length} set${todaySets.length > 1 ? "s" : ""} today` : "Adds to today's workout"}>
            Log a set
          </CardTitle>
          <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
            {timed ? (
              <label className="block w-28">
                <span className="mb-1 block text-xs font-medium text-text-3">Minutes</span>
                <Input type="number" min={0} step="0.5" inputMode="decimal" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
              </label>
            ) : (
              <label className="block w-24">
                <span className="mb-1 block text-xs font-medium text-text-3">Reps</span>
                <Input type="number" min={0} step="1" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} />
              </label>
            )}
            <label className="block w-28">
              <span className="mb-1 block text-xs font-medium text-text-3">Weight (kg)</span>
              <Input
                type="number"
                min={0}
                step="0.5"
                inputMode="decimal"
                placeholder="body"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </label>
            <Button type="submit" variant="primary" disabled={pending}>
              <Plus className="size-4" /> Add set
            </Button>
          </form>
          {todaySets.length > 0 && (
            <ol className="mt-4 divide-y divide-border rounded-xl border border-border">
              {todaySets.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="w-12 text-xs text-text-3">Set {i + 1}</span>
                  <span className="tabular flex-1 font-medium">{setLabel(s)}</span>
                  <button
                    onClick={() => start(() => deleteSet(s.id))}
                    className="rounded-md p-1 text-text-3 hover:bg-surface-2 hover:text-bad"
                    aria-label={`Delete set ${i + 1}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ol>
          )}
          {best && (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-warn/10 px-3 py-2.5 text-sm">
              <Trophy className="size-4 text-warn" aria-hidden />
              <span>
                Best: <span className="font-semibold">{setLabel(best)}</span>
                <span className="text-text-3"> · est. 1RM {fmtKg(best1RM)}</span>
              </span>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle sub={weighted.length ? "Heaviest weight and estimated 1RM per week" : "Your history with this exercise"}>
            Weekly progress
          </CardTitle>
          {weighted.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--grid)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-3)" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-3)" }} tickLine={false} axisLine={false} width={44} unit=" kg" />
                  <Tooltip
                    contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v, n) => [`${v} kg`, n === "best" ? "Heaviest" : "Est. 1RM"]}
                  />
                  <Line dataKey="best" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line dataKey="oneRm" stroke="var(--series-2)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-text-3">You haven&apos;t logged this exercise yet.</p>
          ) : null}
          {sessions.length > 0 && (
            <ul className="mt-3 max-h-64 divide-y divide-border overflow-y-auto text-sm">
              {sessions.slice(0, 20).map((d) => (
                <li key={d} className="flex gap-3 py-2">
                  <span className="w-24 shrink-0 font-medium">{relativeDayLabel(d, today)}</span>
                  <span className="text-text-2">
                    {sets
                      .filter((s) => s.date === d)
                      .map((s) => setLabel(s))
                      .join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {loggedWeeks.length > 0 && (
        <Card className="p-0 sm:p-0">
          <div className="p-4 pb-3 sm:p-5 sm:pb-3">
            <h2 className="text-base font-semibold">Week by week</h2>
            <p className="mt-0.5 text-xs text-text-3">Your best set each week and how it compares with the week before</p>
          </div>
          <div className="overflow-x-auto border-t border-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs text-text-3">
                  <th className="px-4 py-2 font-medium">Week of</th>
                  <th className="px-3 py-2 text-right font-medium">Sessions</th>
                  <th className="px-3 py-2 text-right font-medium">Sets</th>
                  <th className="px-3 py-2 text-right font-medium">{timed ? "Time" : "Top set"}</th>
                  <th className="px-3 py-2 text-right font-medium">Est. 1RM</th>
                  <th className="px-3 py-2 text-right font-medium">Volume</th>
                  <th className="px-4 py-2 text-right font-medium">vs prev. week</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loggedWeeks.map(({ w, delta }) => (
                  <tr key={w.week}>
                    <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                      {w.week === thisWeek ? "This week" : prettyDay(w.week, { weekday: undefined, year: w.week.slice(0, 4) !== today.slice(0, 4) ? "numeric" : undefined })}
                    </td>
                    <td className="tabular px-3 py-2.5 text-right">{w.sessions}</td>
                    <td className="tabular px-3 py-2.5 text-right">{w.sets}</td>
                    <td className="tabular px-3 py-2.5 text-right font-semibold">
                      {timed && w.duration
                        ? `${Math.round(w.duration / 60)} min`
                        : w.topWeight !== null
                          ? `${fmtKg(w.topWeight)}${w.topReps ? ` × ${w.topReps}` : ""}`
                          : w.maxReps
                            ? `${w.maxReps} reps`
                            : "–"}
                    </td>
                    <td className="tabular px-3 py-2.5 text-right text-text-2">{w.best1RM ? fmtKg(w.best1RM) : "–"}</td>
                    <td className="tabular px-3 py-2.5 text-right text-text-2">{w.volume ? `${Math.round(w.volume).toLocaleString()} kg` : "–"}</td>
                    <td className="px-4 py-2.5 text-right">
                      {delta === null ? (
                        <span className="text-text-3">–</span>
                      ) : delta === 0 ? (
                        <span className="text-xs text-text-3">same</span>
                      ) : (
                        <span className={cn("inline-flex items-center gap-1 text-xs font-medium", delta > 0 ? "text-good" : "text-bad")}>
                          {delta > 0 ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />}
                          {delta > 0 ? "+" : "−"}
                          {Math.abs(delta)} kg
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
