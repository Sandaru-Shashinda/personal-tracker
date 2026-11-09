"use client";

import { NotebookPen, Pin, PinOff, Plus, Search, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Markdown } from "@/components/markdown";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast";
import { Button, cn, COLORS, Empty, Input, Modal, Textarea, Fab } from "@/components/ui";
import { deleteNote, saveNote, setNotePinned } from "@/lib/actions/notes";
import type { Note } from "@/lib/db/schema";

type Draft = { id: string | null; title: string; content: string; color: string | null; pinned: boolean };

const blank: Draft = { id: null, title: "", content: "", color: null, pinned: false };

function ago(d: Date) {
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: mins > 60 * 24 * 300 ? "numeric" : undefined });
}

export function NotesView({ notes }: { notes: Note[] }) {
  const [, start] = useTransition();
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const text = q.toLowerCase();
  const shown = notes.filter((n) => !text || n.title.toLowerCase().includes(text) || n.content.toLowerCase().includes(text));
  const pinned = shown.filter((n) => n.pinned);
  const others = shown.filter((n) => !n.pinned);

  const open = (n: Note) => setDraft({ id: n.id, title: n.title, content: n.content, color: n.color, pinned: n.pinned });

  return (
    <div>
      <PageHeader
        title="Notes"
        sub={`${notes.length} note${notes.length === 1 ? "" : "s"}`}
        action={
          <Button variant="primary" onClick={() => setDraft(blank)} className="max-md:hidden">
            <Plus className="size-4" /> New note
          </Button>
        }
      />
      {notes.length > 0 && (
        <div className="relative mb-5 sm:max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-3" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes" className="pl-9" aria-label="Search notes" />
        </div>
      )}

      {notes.length === 0 ? (
        <button onClick={() => setDraft(blank)} className="block w-full text-left">
          <Empty icon={<NotebookPen className="size-8" />} title="No notes yet">
            Jot down ideas, lists, meeting notes, anything. Tap to write your first note.
          </Empty>
        </button>
      ) : shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-text-3">No notes match “{q}”.</p>
      ) : (
        <div className="space-y-6">
          {pinned.length > 0 && <Section label="Pinned" notes={pinned} onOpen={open} onPin={(n) => start(() => setNotePinned(n.id, false))} />}
          {others.length > 0 && (
            <Section
              label={pinned.length ? "Others" : ""}
              notes={others}
              onOpen={open}
              onPin={(n) => start(() => setNotePinned(n.id, true))}
            />
          )}
        </div>
      )}

      <Fab label="New note" onClick={() => setDraft(blank)} />
      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Edit note" : "New note"} wide>
        {draft && <NoteEditor initial={draft} onDone={() => setDraft(null)} />}
      </Modal>
    </div>
  );
}

function Section({
  label,
  notes,
  onOpen,
  onPin,
}: {
  label: string;
  notes: Note[];
  onOpen: (n: Note) => void;
  onPin: (n: Note) => void;
}) {
  return (
    <section>
      {label && <h2 className="mb-2 text-xs font-semibold tracking-wide text-text-3 uppercase">{label}</h2>}
      <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
        {notes.map((n) => (
          <article
            key={n.id}
            className="group relative mb-3 break-inside-avoid rounded-2xl border bg-surface p-4 transition-shadow hover:shadow-md"
            style={n.color ? { borderColor: `${n.color}66`, background: `color-mix(in srgb, ${n.color} 9%, var(--surface))` } : { borderColor: "var(--border)" }}
          >
            <button onClick={() => onOpen(n)} className="block w-full text-left" aria-label={`Open note ${n.title || "untitled"}`}>
              {n.title && <h3 className="mb-1 pr-8 font-semibold">{n.title}</h3>}
              {n.content && <Markdown source={n.content} compact className="text-sm text-text-2" />}
              <p className="mt-2 text-xs text-text-3">{ago(n.updatedAt)}</p>
            </button>
            <button
              onClick={() => onPin(n)}
              className={cn(
                "absolute top-2 right-2 flex size-9 items-center justify-center rounded-md text-text-3 hover:bg-surface-2 hover:text-text active:bg-surface-2",
                !n.pinned && "can-hover:opacity-0 can-hover:group-hover:opacity-100 can-hover:focus:opacity-100",
              )}
              aria-label={n.pinned ? "Unpin note" : "Pin note"}
            >
              {n.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function NoteEditor({ initial, onDone }: { initial: Draft; onDone: () => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [d, setD] = useState(initial);
  // Existing notes open rendered so they read (and tick) like a note; new ones open for writing.
  const [mode, setMode] = useState<"write" | "preview">(initial.id && initial.content.trim() ? "preview" : "write");

  /** Ticking a checklist item in preview saves straight away for existing notes. */
  function toggleTask(content: string) {
    const next = { ...d, content };
    setD(next);
    if (!next.id) return;
    start(async () => {
      const res = await saveNote(next.id, { title: next.title, content: next.content, color: next.color, pinned: next.pinned });
      if (!res.ok) toast(res.error, "bad");
    });
  }

  function save() {
    start(async () => {
      const res = await saveNote(d.id, { title: d.title, content: d.content, color: d.color, pinned: d.pinned });
      if (!res.ok) return toast(res.error, "bad");
      toast(d.id ? "Note saved" : "Note added");
      onDone();
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          save();
        }
      }}
      className="space-y-3"
    >
      <Input
        value={d.title}
        onChange={(e) => setD({ ...d, title: e.target.value })}
        placeholder="Title"
        className="h-11 text-base font-semibold"
        maxLength={200}
        autoFocus={!d.id}
      />
      <div className="flex items-center justify-between gap-2">
        <div role="tablist" aria-label="Note view" className="inline-flex rounded-lg bg-surface-2 p-0.5">
          {(["write", "preview"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "h-8 rounded-md px-3 text-sm font-medium capitalize text-text-3 hover:text-text",
                mode === m && "bg-surface text-text shadow-sm",
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <span className="text-xs text-text-3">Markdown supported</span>
      </div>
      {mode === "write" ? (
        <>
          <Textarea
            value={d.content}
            onChange={(e) => setD({ ...d, content: e.target.value })}
            placeholder="Write your note…"
            rows={12}
            className="min-h-60 font-mono text-sm leading-relaxed"
            autoFocus={!!d.id}
          />
          <p className="text-xs leading-relaxed text-text-3">
            <code># Heading</code> · <code>**bold**</code> · <code>*italic*</code> · <code>- list</code> ·{" "}
            <code>- [ ] task</code> · <code>[link](https://…)</code> · <code>`code`</code> · <code>&gt; quote</code>
          </p>
        </>
      ) : (
        <div className="min-h-60 rounded-lg border border-border px-3 py-2.5">
          {d.content.trim() ? (
            <Markdown source={d.content} onChange={toggleTask} className="text-[15px]" />
          ) : (
            <p className="text-sm text-text-3">Nothing to preview yet.</p>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-3">Colour</span>
        <button
          type="button"
          onClick={() => setD({ ...d, color: null })}
          aria-pressed={d.color === null}
          aria-label="No colour"
          className={cn("size-6 rounded-full border border-border bg-surface", d.color === null && "ring-2 ring-text ring-offset-2 ring-offset-surface")}
        />
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setD({ ...d, color: c })}
            aria-pressed={d.color === c}
            aria-label={`Colour ${c}`}
            className={cn("size-6 rounded-full", d.color === c && "ring-2 ring-text ring-offset-2 ring-offset-surface")}
            style={{ background: c }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => setD({ ...d, pinned: !d.pinned })} aria-pressed={d.pinned}>
          {d.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />} {d.pinned ? "Unpin" : "Pin"}
        </Button>
        {d.id && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="hover:text-bad"
            onClick={() => {
              if (!confirm("Delete this note?")) return;
              start(async () => {
                await deleteNote(d.id!);
                toast("Note deleted");
                onDone();
              });
            }}
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        )}
        <span className="ml-auto hidden text-xs text-text-3 sm:inline">Ctrl + Enter to save</span>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
