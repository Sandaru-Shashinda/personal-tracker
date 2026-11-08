"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { EnergyPicker, MoodPicker, moodEmoji } from "@/components/mood";
import { PageHeader } from "@/components/page-header";
import { Button, cn, Input, TagInput, Textarea } from "@/components/ui";
import { saveJournalEntry } from "@/lib/actions/journal";
import { addDays, parseDay, prettyDay, startOfWeek, WEEKDAY_SHORT } from "@/lib/dates";

type Entry = { date: string; mood: number | null; energy: number | null; content: string; tags: string[] };

// mood 1..5 mapped to the diverging-ish feel via the sequential ramp: low = light, high = dark
const MOOD_BG = ["", "var(--seq-1)", "var(--seq-2)", "var(--seq-3)", "var(--seq-4)", "var(--seq-5)"];

export function JournalView({
  date,
  today,
  weekStartsOn,
  entries,
}: {
  date: string;
  today: string;
  weekStartsOn: number;
  entries: Entry[];
}) {
  const router = useRouter();
  const [saving, start] = useTransition();
  const byDate = useMemo(() => new Map(entries.map((e) => [e.date, e])), [entries]);
  const initial = byDate.get(date);
  const [month, setMonth] = useState(date.slice(0, 7));
  const [mood, setMood] = useState(initial?.mood ?? null);
  const [energy, setEnergy] = useState(initial?.energy ?? null);
  const [content, setContent] = useState(initial?.content ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(JSON.stringify({ content: initial?.content ?? "", tags: initial?.tags ?? [] }));

  // autosave content + tags (debounced), only when they actually changed
  useEffect(() => {
    const snapshot = JSON.stringify({ content, tags });
    if (snapshot === lastSaved.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      start(async () => {
        await saveJournalEntry({ date, content, tags });
        lastSaved.current = snapshot;
        setSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      });
    }, 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [content, tags, date]);

  const saveNow = (patch: { mood?: number | null; energy?: number | null }) =>
    start(async () => {
      await saveJournalEntry({ date, ...patch });
      setSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    });

  const [y, m] = month.split("-").map(Number);
  const gridStart = startOfWeek(`${month}-01`, weekStartsOn);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const shift = (n: number) => setMonth(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7));
  const monthEntries = entries.filter((e) => e.date.startsWith(month));
  const moodVals = monthEntries.filter((e) => e.mood).map((e) => e.mood!);
  const avg = moodVals.length ? moodVals.reduce((a, b) => a + b, 0) / moodVals.length : null;

  // writing streak
  let streak = 0;
  for (let d = byDate.has(today) ? today : addDays(today, -1); byDate.has(d); d = addDays(d, -1)) streak++;

  const results = q
    ? entries.filter(
        (e) => e.content.toLowerCase().includes(q.toLowerCase()) || e.tags.some((t) => t.includes(q.toLowerCase().replace(/^#/, ""))),
      )
    : entries.filter((e) => e.content).slice(0, 8);

  const go = (d: string) => router.push(`/journal?date=${d}`, { scroll: false });

  return (
    <div>
      <PageHeader title="Journal" sub={`${entries.length} entries · ${streak}-day streak`} />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">
                  {parseDay(`${month}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
                </h2>
                <p className="text-xs text-text-3">
                  {monthEntries.length} entries{avg ? ` · avg mood ${avg.toFixed(1)} ${moodEmoji(Math.round(avg))}` : ""}
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" onClick={() => shift(-1)} aria-label="Previous month">
                  <ChevronLeft className="size-4" />
                </Button>
                <Button size="icon" onClick={() => shift(1)} disabled={month >= today.slice(0, 7)} aria-label="Next month">
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-text-3">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i}>{WEEKDAY_SHORT[(weekStartsOn + i) % 7].slice(0, 2)}</span>
              ))}
              {cells.map((d) => {
                const e = byDate.get(d);
                const future = d > today;
                const dark = (e?.mood ?? 0) >= 4;
                return (
                  <button
                    key={d}
                    disabled={future}
                    onClick={() => go(d)}
                    aria-label={`${d}${e?.mood ? `, mood ${e.mood}` : ""}${e?.content ? ", has entry" : ""}`}
                    aria-current={d === date ? "date" : undefined}
                    className={cn(
                      "relative flex aspect-square items-center justify-center rounded-lg text-xs transition",
                      !d.startsWith(month) && "opacity-30",
                      future ? "cursor-default" : "hover:ring-2 hover:ring-border",
                      d === date && "ring-2 ring-text",
                      !e?.mood && !future && "bg-surface-2",
                    )}
                    style={e?.mood ? { background: MOOD_BG[e.mood], color: dark ? "white" : "var(--text)" } : undefined}
                  >
                    {Number(d.slice(8))}
                    {e?.content && <span className="absolute bottom-1 size-1 rounded-full bg-current opacity-70" aria-hidden />}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-text-3">
              <span>Mood</span>
              <span className="flex items-center gap-1">
                {MOOD_BG.slice(1).map((c, i) => (
                  <span key={i} className="flex size-4 items-center justify-center rounded" style={{ background: c }} title={`${i + 1}`} />
                ))}
              </span>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-4">
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" aria-hidden />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search entries or #tags" className="pl-9" aria-label="Search journal" />
            </div>
            <ul className="space-y-1">
              {results.length === 0 && <li className="py-4 text-center text-sm text-text-3">{q ? "No matches" : "No entries yet"}</li>}
              {results.slice(0, 30).map((e) => (
                <li key={e.date}>
                  <Link
                    href={`/journal?date=${e.date}`}
                    scroll={false}
                    className={cn("block rounded-lg px-2 py-1.5 hover:bg-surface-2", e.date === date && "bg-surface-2")}
                  >
                    <p className="flex items-center gap-1.5 text-xs font-medium text-text-2">
                      {moodEmoji(e.mood)} {prettyDay(e.date, { year: "numeric" })}
                    </p>
                    <p className="line-clamp-1 text-sm text-text-3">{e.content || "(mood only)"}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => go(addDays(date, -1))} aria-label="Previous day">
                <ChevronLeft className="size-4" />
              </Button>
              <h2 className="text-lg font-semibold">{prettyDay(date, { weekday: "long", year: "numeric" })}</h2>
              <Button size="icon" variant="ghost" disabled={date >= today} onClick={() => go(addDays(date, 1))} aria-label="Next day">
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <span className="text-xs text-text-3" aria-live="polite">
              {saving ? "Saving…" : savedAt ? `Saved ${savedAt}` : ""}
            </span>
          </div>
          <p className="mb-2 text-sm font-medium text-text-2">Mood</p>
          <MoodPicker
            size="lg"
            value={mood}
            onChange={(v) => {
              setMood(v);
              saveNow({ mood: v });
            }}
          />
          <p className="mb-2 mt-5 text-sm font-medium text-text-2">Energy</p>
          <EnergyPicker
            value={energy}
            onChange={(v) => {
              setEnergy(v);
              saveNow({ energy: v });
            }}
          />
          <p className="mb-2 mt-5 text-sm font-medium text-text-2">Entry</p>
          <Textarea
            rows={14}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={"What happened today?\nWhat went well? What would you do differently?\nWhat are you grateful for?"}
            className="leading-relaxed"
          />
          <p className="mt-1 text-right text-xs text-text-3">{content.trim() ? content.trim().split(/\s+/).length : 0} words</p>
          <p className="mb-2 mt-3 text-sm font-medium text-text-2">Tags</p>
          <TagInput value={tags} onChange={setTags} placeholder="gratitude, work, travel…" />
        </section>
      </div>
    </div>
  );
}
