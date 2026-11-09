"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { cn } from "@/components/ui";

export type TrendPoint = { key: string; label: string; value: number | null };

const axis = { fontSize: 11, fill: "var(--text-3)" };

function Shell({
  title,
  sub,
  action,
  children,
  className,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-surface shadow-card p-4 sm:p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {sub && <p className="text-xs text-text-3">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-text">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-text-2">
          {r.color && <span className="h-0.5 w-3 rounded" style={{ background: r.color }} aria-hidden />}
          {r.label}
          <span className="tabular ml-auto pl-3 font-medium text-text">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

export function TrendChart({ daily, weekly, monthly }: { daily: TrendPoint[]; weekly: TrendPoint[]; monthly: TrendPoint[] }) {
  const [range, setRange] = useState<"30d" | "12w" | "12m">("30d");
  const data = range === "30d" ? daily : range === "12w" ? weekly : monthly;
  const valid = data.filter((d) => d.value !== null);
  const avg = valid.length ? Math.round(valid.reduce((s, d) => s + d.value!, 0) / valid.length) : null;
  const unitLabel = range === "30d" ? "Day" : range === "12w" ? "Week of" : "Month";

  return (
    <Shell
      title="Completion trend"
      sub={avg === null ? "Share of due habits completed" : `Average ${avg}% over this period`}
      action={
        <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5 text-xs" role="radiogroup" aria-label="Range">
          {(["30d", "12w", "12m"] as const).map((r) => (
            <button
              key={r}
              role="radio"
              aria-checked={range === r}
              onClick={() => setRange(r)}
              className={cn("rounded-md px-2.5 py-1", range === r ? "bg-surface font-medium shadow-sm" : "text-text-2")}
            >
              {r === "30d" ? "30 days" : r === "12w" ? "12 weeks" : "12 months"}
            </button>
          ))}
        </div>
      }
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {range === "30d" ? (
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={axis} tickLine={false} axisLine={false} unit="%" />
              <Tooltip
                cursor={{ stroke: "var(--text-3)", strokeDasharray: "3 3" }}
                content={({ active, payload }: TooltipContentProps) =>
                  active && payload?.[0] ? (
                    <TooltipBox
                      title={`${unitLabel} ${payload[0].payload.key}`}
                      rows={[
                        {
                          label: "Completed",
                          value: payload[0].value == null ? "nothing due" : `${payload[0].value}%`,
                          color: "var(--series-1)",
                        },
                      ]}
                    />
                  ) : null
                }
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--series-1)"
                strokeWidth={2}
                fill="url(#trendFill)"
                connectNulls
                activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
                dot={false}
              />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={axis} tickLine={false} axisLine={false} unit="%" />
              <Tooltip
                cursor={{ fill: "var(--surface-2)" }}
                content={({ active, payload }: TooltipContentProps) =>
                  active && payload?.[0] ? (
                    <TooltipBox
                      title={`${unitLabel} ${range === "12m" ? payload[0].payload.label : payload[0].payload.key}`}
                      rows={[
                        {
                          label: "Completed",
                          value: payload[0].value == null ? "nothing due" : `${payload[0].value}%`,
                          color: "var(--series-1)",
                        },
                      ]}
                    />
                  ) : null
                }
              />
              <Bar dataKey="value" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </Shell>
  );
}

export function MoodChart({ data }: { data: { label: string; date: string; mood: number | null; energy: number | null }[] }) {
  const has = data.some((d) => d.mood !== null || d.energy !== null);
  const last = [...data].reverse();
  const lastMood = last.find((d) => d.mood !== null);
  const lastEnergy = last.find((d) => d.energy !== null);
  return (
    <Shell title="Mood & energy" sub="Last 30 days, on a 1–5 scale">
      <div className="mb-2 flex gap-4 text-xs text-text-2" aria-label="Legend">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: "var(--series-1)" }} aria-hidden />
          Mood{lastMood ? ` · ${lastMood.mood}` : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded border-t-2 border-dashed" style={{ borderColor: "var(--series-2)" }} aria-hidden />
          Energy{lastEnergy ? ` · ${lastEnergy.energy}` : ""}
        </span>
      </div>
      <div className="h-48">
        {has ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis domain={[1, 5]} ticks={[1, 3, 5]} tick={axis} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ stroke: "var(--text-3)", strokeDasharray: "3 3" }}
                content={({ active, payload }: TooltipContentProps) =>
                  active && payload?.length ? (
                    <TooltipBox
                      title={payload[0].payload.date}
                      rows={[
                        { label: "Mood", value: payload[0].payload.mood ?? "–", color: "var(--series-1)" },
                        { label: "Energy", value: payload[0].payload.energy ?? "–", color: "var(--series-2)" },
                      ]}
                    />
                  ) : null
                }
              />
              <Line type="monotone" dataKey="mood" stroke="var(--series-1)" strokeWidth={2} connectNulls dot={{ r: 3, strokeWidth: 0, fill: "var(--series-1)" }} activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }} />
              <Line type="monotone" dataKey="energy" stroke="var(--series-2)" strokeWidth={2} strokeDasharray="4 3" connectNulls dot={false} activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Placeholder>Log your mood on the Today page to see trends.</Placeholder>
        )}
      </div>
    </Shell>
  );
}

export function TasksChart({ data }: { data: { label: string; date: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <Shell title="Tasks completed" sub={`${total} in the last 14 days`}>
      <div className="h-48 pt-6">
        {total ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={20} />
              <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: "var(--surface-2)" }}
                content={({ active, payload }: TooltipContentProps) =>
                  active && payload?.[0] ? (
                    <TooltipBox title={payload[0].payload.date} rows={[{ label: "Completed", value: String(payload[0].value) }]} />
                  ) : null
                }
              />
              <Bar dataKey="value" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Placeholder>Complete a task to start the chart.</Placeholder>
        )}
      </div>
    </Shell>
  );
}

export function CategoryBars({ data }: { data: { name: string; value: number; habits: number }[] }) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  return (
    <Shell title="By category" sub="30-day habit completion">
      {sorted.length ? (
        <ul className="space-y-3 pt-1">
          {sorted.map((c) => (
            <li key={c.name} title={`${c.name}: ${c.value}% across ${c.habits} habit${c.habits === 1 ? "" : "s"}`}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-text-2">
                  {c.name} <span className="text-xs text-text-3">· {c.habits}</span>
                </span>
                <span className="tabular font-medium">{c.value}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full" style={{ width: `${c.value}%`, background: "var(--series-1)" }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="h-48">
          <Placeholder>Assign habits to categories to compare them.</Placeholder>
        </div>
      )}
    </Shell>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border px-4 text-center text-sm text-text-3">
      {children}
    </div>
  );
}
