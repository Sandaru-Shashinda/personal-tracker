"use client";

import { useEffect, useRef, useState } from "react";
import { parseDay, prettyDay, WEEKDAY_SHORT } from "@/lib/dates";

type Day = { date: string; ratio: number | null; done: number; due: number; tasks: number; mood: number | null };

const STEPS = ["var(--seq-0)", "var(--seq-1)", "var(--seq-2)", "var(--seq-3)", "var(--seq-4)", "var(--seq-5)"];

function bucket(r: number | null) {
  if (r === null || r === 0) return 0;
  if (r < 0.25) return 1;
  if (r < 0.5) return 2;
  if (r < 0.75) return 3;
  if (r < 1) return 4;
  return 5;
}

const MOOD = ["", "😞", "😕", "😐", "🙂", "😄"];

export function Heatmap({ days, weekStartsOn }: { days: Day[]; weekStartsOn: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ d: Day; x: number; y: number } | null>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const weeks: Day[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const monthLabels = weeks.map((w, i) => {
    const first = w[0];
    const prev = weeks[i - 1]?.[0];
    if (!prev || parseDay(first.date).getUTCMonth() !== parseDay(prev.date).getUTCMonth()) {
      return parseDay(first.date).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
    }
    return "";
  });

  const rowLabels = Array.from({ length: 7 }, (_, i) => WEEKDAY_SHORT[(weekStartsOn + i) % 7]);
  const CELL = 12;
  const GAP = 3;

  return (
    <div className="relative">
      <div ref={scroller} className="overflow-x-auto pb-2">
        <div className="inline-flex gap-2">
          <div className="flex flex-col pt-5 text-[10px] text-text-3" style={{ gap: GAP }} aria-hidden>
            {rowLabels.map((l, i) => (
              <span key={l} style={{ height: CELL, lineHeight: `${CELL}px` }}>
                {i % 2 === 0 ? l : ""}
              </span>
            ))}
          </div>
          <div>
            <div className="flex h-5 text-[10px] text-text-3" style={{ gap: GAP }} aria-hidden>
              {monthLabels.map((m, i) => (
                <span key={i} style={{ width: CELL }} className="overflow-visible whitespace-nowrap">
                  {m}
                </span>
              ))}
            </div>
            <div className="flex" style={{ gap: GAP }} role="grid" aria-label="Daily habit completion heatmap">
              {weeks.map((w) => (
                <div key={w[0].date} className="flex flex-col" style={{ gap: GAP }} role="row">
                  {w.map((d) => {
                    const b = bucket(d.ratio);
                    const label = `${prettyDay(d.date, { year: "numeric" })}: ${
                      d.due ? `${d.done} of ${d.due} habits` : "nothing due"
                    }${d.tasks ? `, ${d.tasks} tasks` : ""}`;
                    return (
                      <div
                        key={d.date}
                        role="gridcell"
                        aria-label={label}
                        tabIndex={-1}
                        onMouseEnter={(e) => {
                          const r = (e.target as HTMLElement).getBoundingClientRect();
                          const host = scroller.current!.parentElement!.getBoundingClientRect();
                          setHover({ d, x: r.left - host.left + CELL / 2, y: r.top - host.top });
                        }}
                        onMouseLeave={() => setHover(null)}
                        className="rounded-[3px] outline-offset-1 hover:outline hover:outline-2 hover:outline-text"
                        style={{
                          width: CELL,
                          height: CELL,
                          background: STEPS[b],
                          opacity: d.ratio === null && d.done === 0 ? 0.55 : 1,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: hover.x, top: hover.y - 6 }}
        >
          <p className="font-medium text-text">{prettyDay(hover.d.date, { year: "numeric" })}</p>
          <p className="tabular text-text-2">
            {hover.d.due ? `${hover.d.done}/${hover.d.due} habits · ${Math.round((hover.d.ratio ?? 0) * 100)}%` : "No habits due"}
          </p>
          {hover.d.tasks > 0 && <p className="text-text-2">{hover.d.tasks} tasks completed</p>}
          {hover.d.mood && <p className="text-text-2">Mood {MOOD[hover.d.mood]}</p>}
        </div>
      )}

      <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-text-3">
        Less
        {STEPS.map((s, i) => (
          <span key={i} className="size-3 rounded-[3px]" style={{ background: s }} aria-hidden />
        ))}
        More
      </div>
    </div>
  );
}

