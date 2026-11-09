"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";

const axis = { fontSize: 11, fill: "var(--text-3)" };

function Tip({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-text">{title}</p>
      <p className="tabular text-text-2">{value}</p>
    </div>
  );
}

export function ValueChart({
  data,
  target,
  unit,
  color,
}: {
  data: { label: string; date: string; value: number }[];
  target: number;
  unit: string;
  color: string;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface shadow-card p-4 sm:p-5">
      <h2 className="text-base font-semibold">Daily amount</h2>
      <p className="mb-4 text-xs text-text-3">
        Last 30 days · dashed line = target ({target} {unit})
      </p>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={({ active, payload }: TooltipContentProps) =>
                active && payload?.[0] ? <Tip title={payload[0].payload.date} value={`${payload[0].value} / ${target} ${unit}`} /> : null
              }
            />
            <ReferenceLine y={target} stroke="var(--text-3)" strokeDasharray="4 4" />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function WeekdayChart({ data }: { data: { label: string; value: number; done: number }[] }) {
  return (
    <section className="rounded-2xl border border-border bg-surface shadow-card p-4 sm:p-5">
      <h2 className="text-base font-semibold">By weekday</h2>
      <p className="mb-4 text-xs text-text-3">Completion rate per weekday, last 6 months</p>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} ticks={[0, 50, 100]} unit="%" tick={axis} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={({ active, payload }: TooltipContentProps) =>
                active && payload?.[0] ? (
                  <Tip title={payload[0].payload.label} value={`${payload[0].value}% · ${payload[0].payload.done} times`} />
                ) : null
              }
            />
            <Bar dataKey="value" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
