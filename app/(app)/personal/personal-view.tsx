"use client";

import {
  AlertTriangle,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast";
import { Button, Card, CardTitle, cn, Empty, Input, Label, Modal, Select, Textarea } from "@/components/ui";
import { deleteDocument, saveProfile, updateDocument } from "@/lib/actions/personal";
import { diffDays, prettyDay } from "@/lib/dates";
import type { DocumentMeta } from "@/lib/db/schema";
import { DOCUMENT_CATEGORIES, MAX_DOCUMENT_BYTES, PROFILE_SECTIONS, type Profile } from "@/lib/personal";

type Tab = "info" | "documents";

export function PersonalView({
  profile,
  updatedAt,
  documents,
  today,
}: {
  profile: Profile;
  updatedAt: Date | null;
  documents: DocumentMeta[];
  today: string;
}) {
  const [tab, setTab] = useState<Tab>("info");
  const alerts = expiryAlerts(profile, documents, today);

  return (
    <div>
      <PageHeader
        title="Personal"
        sub="Your details and important documents, private to you"
        action={
          <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5 text-sm" role="tablist">
            {(
              [
                ["info", "Information"],
                ["documents", `Documents${documents.length ? ` (${documents.length})` : ""}`],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cn("rounded-md px-3 py-1.5", tab === k ? "bg-surface font-medium shadow-sm" : "text-text-2")}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />
      {alerts.length > 0 && (
        <div className="mb-4 space-y-2">
          {alerts.map((a) => (
            <div
              key={a.label}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm",
                a.days < 0 ? "bg-bad/10 text-bad" : "bg-warn/10 text-warn",
              )}
            >
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              <span>
                <span className="font-medium">{a.label}</span>{" "}
                {a.days < 0 ? `expired ${-a.days} day${a.days === -1 ? "" : "s"} ago` : a.days === 0 ? "expires today" : `expires in ${a.days} day${a.days === 1 ? "" : "s"}`}{" "}
                ({prettyDay(a.date, { year: "numeric" })})
              </span>
            </div>
          ))}
        </div>
      )}
      {tab === "info" ? <InfoTab initial={profile} updatedAt={updatedAt} /> : <DocumentsTab documents={documents} today={today} />}
    </div>
  );
}

function expiryAlerts(profile: Profile, docs: DocumentMeta[], today: string) {
  const items = [
    { label: "Passport", date: profile.passportExpiry },
    { label: "Driving licence", date: profile.drivingLicenseExpiry },
    ...docs.map((d) => ({ label: d.name, date: d.expiryDate ?? "" })),
  ];
  return items
    .filter((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.date))
    .map((i) => ({ ...i, days: diffDays(i.date, today) }))
    .filter((i) => i.days <= 60)
    .sort((a, b) => a.days - b.days);
}

/* ------------------------------------------------------------------ Information */

function InfoTab({ initial, updatedAt }: { initial: Profile; updatedAt: Date | null }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [p, setP] = useState<Profile>(initial);
  const [saved, setSaved] = useState(initial);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const dirty = JSON.stringify(p) !== JSON.stringify(saved);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await saveProfile(p);
      if (!res.ok) return toast(res.error, "bad");
      setSaved(p);
      toast("Information saved");
    });
  }

  const copy = async (v: string) => {
    try {
      await navigator.clipboard.writeText(v);
      toast("Copied");
    } catch {
      toast("Couldn't copy", "bad");
    }
  };

  return (
    <form onSubmit={save} className="space-y-4 pb-20">
      {PROFILE_SECTIONS.map((section) => (
        <Card key={section.title}>
          <CardTitle sub={section.sub}>{section.title}</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            {section.fields.map((f) => {
              const value = p[f.key] as string;
              const hidden = f.secret && !revealed.has(f.key);
              return (
                <label key={f.key} className={cn("block", f.type === "textarea" && "sm:col-span-2")}>
                  <Label>{f.label}</Label>
                  {f.type === "textarea" ? (
                    <Textarea rows={2} value={value} onChange={(e) => set(f.key, e.target.value as never)} />
                  ) : f.type === "select" ? (
                    <Select value={value} onChange={(e) => set(f.key, e.target.value as never)}>
                      {f.options!.map((o) => (
                        <option key={o} value={o}>
                          {o || "Not set"}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <div className="relative">
                      <Input
                        type={f.type === "date" ? "date" : hidden ? "password" : "text"}
                        autoComplete="off"
                        value={value}
                        onChange={(e) => set(f.key, e.target.value as never)}
                        className={cn(f.secret && "pr-18")}
                      />
                      {f.secret && (
                        <span className="absolute inset-y-0 right-1 flex items-center">
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-text-3 hover:bg-surface-2 hover:text-text"
                            onClick={() =>
                              setRevealed((r) => {
                                const n = new Set(r);
                                if (n.has(f.key)) n.delete(f.key);
                                else n.add(f.key);
                                return n;
                              })
                            }
                            aria-label={hidden ? `Show ${f.label}` : `Hide ${f.label}`}
                          >
                            {hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                          </button>
                          {value && (
                            <button
                              type="button"
                              className="rounded-md p-1.5 text-text-3 hover:bg-surface-2 hover:text-text"
                              onClick={() => copy(value)}
                              aria-label={`Copy ${f.label}`}
                            >
                              <Copy className="size-4" />
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </label>
              );
            })}
          </div>
        </Card>
      ))}

      <Card>
        <CardTitle
          sub="People to contact if something happens"
          action={
            <Button
              type="button"
              size="sm"
              onClick={() => set("emergencyContacts", [...p.emergencyContacts, { name: "", relation: "", phone: "" }])}
              disabled={p.emergencyContacts.length >= 10}
            >
              <Plus className="size-4" /> Add
            </Button>
          }
        >
          Emergency contacts
        </CardTitle>
        {p.emergencyContacts.length === 0 ? (
          <p className="text-sm text-text-3">No emergency contacts yet.</p>
        ) : (
          <div className="space-y-3">
            {p.emergencyContacts.map((c, i) => {
              const update = (k: keyof typeof c, v: string) =>
                set(
                  "emergencyContacts",
                  p.emergencyContacts.map((x, j) => (j === i ? { ...x, [k]: v } : x)),
                );
              return (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <Input placeholder="Name" value={c.name} onChange={(e) => update("name", e.target.value)} aria-label="Contact name" />
                  <Input
                    placeholder="Relationship"
                    value={c.relation}
                    onChange={(e) => update("relation", e.target.value)}
                    aria-label="Relationship"
                  />
                  <Input placeholder="Phone" value={c.phone} onChange={(e) => update("phone", e.target.value)} aria-label="Phone" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => set("emergencyContacts", p.emergencyContacts.filter((_, j) => j !== i))}
                    aria-label="Remove contact"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle
          sub="Anything else: bank branch, vehicle number, Wi-Fi, membership IDs…"
          action={
            <Button
              type="button"
              size="sm"
              onClick={() => set("custom", [...p.custom, { label: "", value: "" }])}
              disabled={p.custom.length >= 50}
            >
              <Plus className="size-4" /> Add field
            </Button>
          }
        >
          Other details
        </CardTitle>
        {p.custom.length === 0 ? (
          <p className="text-sm text-text-3">No custom fields yet.</p>
        ) : (
          <div className="space-y-3">
            {p.custom.map((c, i) => {
              const update = (k: "label" | "value", v: string) =>
                set(
                  "custom",
                  p.custom.map((x, j) => (j === i ? { ...x, [k]: v } : x)),
                );
              return (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                  <Input placeholder="Label" value={c.label} onChange={(e) => update("label", e.target.value)} aria-label="Field label" />
                  <Input placeholder="Value" value={c.value} onChange={(e) => update("value", e.target.value)} aria-label="Field value" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => set("custom", p.custom.filter((_, j) => j !== i))}
                    aria-label="Remove field"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="sticky bottom-20 z-20 flex items-center justify-end gap-3 rounded-2xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        <span className="mr-auto text-xs text-text-3">
          {dirty ? "Unsaved changes" : updatedAt ? `Saved ${updatedAt.toLocaleDateString()}` : "Nothing saved yet"}
        </span>
        {dirty && (
          <Button type="button" variant="ghost" onClick={() => setP(saved)}>
            Discard
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ Documents */

function fileSize(n: number) {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function DocIcon({ mime }: { mime: string }) {
  const cls = "size-5";
  if (mime.startsWith("image/")) return <FileImage className={cls} />;
  if (mime.includes("sheet") || mime.includes("excel")) return <FileSpreadsheet className={cls} />;
  return <FileText className={cls} />;
}

function DocumentsTab({ documents, today }: { documents: DocumentMeta[]; today: string }) {
  const toast = useToast();
  const [, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<DocumentMeta | null>(null);
  const [cat, setCat] = useState("");
  const cats = DOCUMENT_CATEGORIES.filter((c) => documents.some((d) => d.category === c));
  const shown = documents.filter((d) => !cat || d.category === cat);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {cats.length > 1 &&
            ["", ...cats].map((c) => (
              <button
                key={c || "all"}
                onClick={() => setCat(c)}
                aria-pressed={cat === c}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm",
                  cat === c ? "border-transparent bg-accent text-accent-fg" : "border-border text-text-2 hover:bg-surface-2",
                )}
              >
                {c || "All"}
              </button>
            ))}
        </div>
        <Button variant="primary" onClick={() => setUploading(true)}>
          <Upload className="size-4" /> Upload document
        </Button>
      </div>

      {documents.length === 0 ? (
        <Empty icon={<FolderOpen className="size-8" />} title="No documents yet">
          Keep scans of your ID, passport, certificates, insurance and more in one place. PDF, images, Word or Excel up to 4 MB.
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((d) => {
            const days = d.expiryDate ? diffDays(d.expiryDate, today) : null;
            return (
              <Card key={d.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <DocIcon mime={d.mimeType} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium" title={d.name}>
                      {d.name}
                    </p>
                    <p className="truncate text-xs text-text-3" title={d.fileName}>
                      {d.category} · {fileSize(d.size)}
                    </p>
                  </div>
                </div>
                {d.expiryDate && (
                  <p
                    className={cn(
                      "text-xs font-medium",
                      days! < 0 ? "text-bad" : days! <= 60 ? "text-warn" : "text-text-3",
                    )}
                  >
                    {days! < 0 ? "Expired" : "Expires"} {prettyDay(d.expiryDate, { year: "numeric" })}
                  </p>
                )}
                {d.notes && <p className="line-clamp-2 text-xs text-text-2">{d.notes}</p>}
                <div className="mt-auto flex gap-1 border-t border-border pt-3">
                  <a
                    href={`/api/documents/${d.id}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-text-2 hover:bg-surface-2 hover:text-text"
                  >
                    <Eye className="size-4" /> Open
                  </a>
                  <a
                    href={`/api/documents/${d.id}?download=1`}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-text-2 hover:bg-surface-2 hover:text-text"
                    aria-label={`Download ${d.name}`}
                  >
                    <Download className="size-4" />
                  </a>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(d)} aria-label={`Edit ${d.name}`}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto size-8 hover:text-bad"
                    aria-label={`Delete ${d.name}`}
                    onClick={() => {
                      if (!confirm(`Delete "${d.name}"? This can't be undone.`)) return;
                      start(async () => {
                        await deleteDocument(d.id);
                        toast("Document deleted");
                      });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={uploading} onClose={() => setUploading(false)} title="Upload document">
        <UploadForm onDone={() => setUploading(false)} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit document">
        {editing && <EditDocForm doc={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

function UploadForm({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Identity");
  const [expiry, setExpiry] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) return setError("Choose a file");
    if (file.size > MAX_DOCUMENT_BYTES) return setError("File is larger than 4 MB. Try a compressed PDF or a smaller photo.");
    const fd = new FormData();
    fd.set("file", file);
    fd.set("name", name);
    fd.set("category", category);
    fd.set("expiryDate", expiry);
    fd.set("notes", notes);
    setBusy(true);
    try {
      const res = await fetch("/api/documents", { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return setError(body.error ?? "Upload failed. Please try again.");
      toast("Document uploaded");
      router.refresh();
      onDone();
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label hint="PDF, image, Word, Excel · max 4 MB">File</Label>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border px-4 py-5 text-left hover:bg-surface-2"
        >
          <Upload className="size-5 text-text-3" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm">
            {file ? (
              <>
                <span className="font-medium">{file.name}</span> <span className="text-text-3">· {fileSize(file.size)}</span>
              </>
            ) : (
              <span className="text-text-3">Choose a file or take a photo</span>
            )}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.gif,.txt,.doc,.docx,.xls,.xlsx,application/pdf,image/*"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            if (f && !name) setName(f.name.replace(/\.[^.]+$/, ""));
          }}
        />
      </div>
      <label className="block">
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Passport" maxLength={120} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <Label>Category</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </label>
        <label className="block">
          <Label hint="optional">Expiry date</Label>
          <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </label>
      </div>
      <label className="block">
        <Label hint="optional">Notes</Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
      </label>
      {error && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Uploading…" : "Upload"}
        </Button>
      </div>
    </form>
  );
}

function EditDocForm({ doc, onDone }: { doc: DocumentMeta; onDone: () => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState(doc.name);
  const [category, setCategory] = useState(doc.category);
  const [expiry, setExpiry] = useState(doc.expiryDate ?? "");
  const [notes, setNotes] = useState(doc.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateDocument(doc.id, { name, category, expiryDate: expiry || null, notes: notes || null });
          if (!res.ok) return setError(res.error);
          toast("Document updated");
          onDone();
        });
      }}
      className="space-y-4"
    >
      <p className="flex items-center gap-2 text-sm text-text-3">
        <UserRound className="size-4" aria-hidden /> {doc.fileName}
      </p>
      <label className="block">
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <Label>Category</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </label>
        <label className="block">
          <Label hint="optional">Expiry date</Label>
          <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </label>
      </div>
      <label className="block">
        <Label hint="optional">Notes</Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
      </label>
      {error && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
      <div className="flex justify-end gap-2">
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
