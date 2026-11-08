"use client";

import { Bell, BellOff, Download, LogOut, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { Icon, PICKABLE_ICONS } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { ThemeSelect } from "@/components/theme-toggle";
import { useToast } from "@/components/toast";
import { Button, Card, CardTitle, cn, ColorPicker, Input, Label, Modal, Select } from "@/components/ui";
import { logout } from "@/lib/actions/auth";
import {
  changePassword,
  deleteAccount,
  deleteCategory,
  removePushSubscription,
  saveCategory,
  savePushSubscription,
  sendTestNotification,
  updateProfile,
} from "@/lib/actions/settings";
import { useDeviceTimezone, useTimezoneList } from "@/lib/client-env";
import type { Category } from "@/lib/db/schema";

type UserInfo = { name: string; email: string; timezone: string; weekStartsOn: number };

export function SettingsView({ user, categories, vapidKey }: { user: UserInfo; categories: Category[]; vapidKey: string | null }) {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" sub={user.email} />
      <Profile user={user} />
      <Card>
        <CardTitle sub="Follows your device by default">Appearance</CardTitle>
        <ThemeSelect />
      </Card>
      <Categories categories={categories} />
      <Notifications vapidKey={vapidKey} />
      <Export />
      <Password />
      <Danger />
    </div>
  );
}

function Profile({ user }: { user: UserInfo }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState(user.name);
  const [tz, setTz] = useState(user.timezone);
  const [ws, setWs] = useState(user.weekStartsOn);
  const allZones = useTimezoneList();
  const deviceTz = useDeviceTimezone();
  const zones = allZones.includes(tz) ? allZones : [tz, ...allZones];

  return (
    <Card>
      <CardTitle sub="Your timezone decides when a new day starts">Profile</CardTitle>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await updateProfile({ name, timezone: tz, weekStartsOn: ws });
            toast(r.ok ? (r.message ?? "Saved") : r.error, r.ok ? "good" : "bad");
          });
        }}
      >
        <label className="block">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <Label>Timezone</Label>
            <Select value={tz} onChange={(e) => setTz(e.target.value)}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
            {deviceTz && deviceTz !== tz && (
              <button type="button" onClick={() => setTz(deviceTz)} className="mt-1 text-xs text-accent hover:underline">
                Use this device&apos;s timezone ({deviceTz})
              </button>
            )}
          </label>
          <label className="block">
            <Label>Week starts on</Label>
            <Select value={ws} onChange={(e) => setWs(Number(e.target.value))}>
              <option value={1}>Monday</option>
              <option value={0}>Sunday</option>
            </Select>
          </label>
        </div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </Card>
  );
}

function Categories({ categories }: { categories: Category[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState<{ id: string | null; name: string; color: string; icon: string } | null>(null);
  return (
    <Card>
      <CardTitle
        sub="Group habits and tasks"
        action={
          <Button size="sm" onClick={() => setEdit({ id: null, name: "", color: "#2a78d6", icon: "folder" })}>
            <Plus className="size-4" /> Add
          </Button>
        }
      >
        Categories
      </CardTitle>
      {categories.length === 0 ? (
        <p className="text-sm text-text-3">No categories yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2">
              <span className="flex size-8 items-center justify-center rounded-lg text-white" style={{ background: c.color }}>
                <Icon name={c.icon} className="size-4" />
              </span>
              <span className="flex-1 text-sm font-medium">{c.name}</span>
              <Button size="icon" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => setEdit({ id: c.id, name: c.name, color: c.color, icon: c.icon })}>
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="hover:text-bad"
                aria-label={`Delete ${c.name}`}
                onClick={() => confirm(`Delete category "${c.name}"? Habits and tasks keep existing, uncategorised.`) && start(() => deleteCategory(c.id))}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit category" : "New category"}>
        {edit && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await saveCategory(edit.id, { name: edit.name, color: edit.color, icon: edit.icon });
                if (!r.ok) return toast(r.error, "bad");
                setEdit(null);
              });
            }}
          >
            <label className="block">
              <Label>Name</Label>
              <Input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required />
            </label>
            <div>
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-1.5">
                {PICKABLE_ICONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={n}
                    aria-pressed={edit.icon === n}
                    onClick={() => setEdit({ ...edit, icon: n })}
                    className={cn("flex size-9 items-center justify-center rounded-lg border", edit.icon === n ? "border-transparent text-white" : "border-border text-text-2")}
                    style={edit.icon === n ? { background: edit.color } : undefined}
                  >
                    <Icon name={n} className="size-4" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Color</Label>
              <ColorPicker value={edit.color} onChange={(color) => setEdit({ ...edit, color })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEdit(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={pending}>
                Save
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </Card>
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function Notifications({ vapidKey }: { vapidKey: string | null }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<"unsupported" | "denied" | "off" | "on" | "loading">("loading");

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setStatus("unsupported");
      if (Notification.permission === "denied") return setStatus("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    })().catch(() => setStatus("unsupported"));
  }, []);

  const enable = () =>
    start(async () => {
      try {
        if (!vapidKey) return toast("Push isn't configured on the server yet", "bad");
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setStatus(perm === "denied" ? "denied" : "off");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
        const r = await savePushSubscription(sub.toJSON());
        if (!r.ok) return toast(r.error, "bad");
        setStatus("on");
        toast("Notifications enabled on this device");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Couldn't enable notifications", "bad");
      }
    });

  const disable = () =>
    start(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
      toast("Notifications turned off on this device");
    });

  return (
    <Card>
      <CardTitle sub="Habit reminders at their set time, task reminders when due">Notifications</CardTitle>
      {status === "unsupported" && (
        <p className="text-sm text-text-3">
          This browser doesn&apos;t support push notifications. On iPhone, add Tracker to your Home Screen first (Share → Add to Home Screen), then open it from there.
        </p>
      )}
      {status === "denied" && <p className="text-sm text-bad">Notifications are blocked. Allow them in your browser&apos;s site settings, then reload.</p>}
      {(status === "off" || status === "on" || status === "loading") && (
        <div className="flex flex-wrap items-center gap-2">
          {status === "on" ? (
            <>
              <span className="mr-2 inline-flex items-center gap-1.5 text-sm text-good">
                <Bell className="size-4" aria-hidden /> Enabled on this device
              </span>
              <Button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await sendTestNotification();
                    toast(r.ok ? (r.message ?? "Sent") : r.error, r.ok ? "good" : "bad");
                  })
                }
              >
                Send test
              </Button>
              <Button variant="ghost" disabled={pending} onClick={disable}>
                <BellOff className="size-4" /> Turn off
              </Button>
            </>
          ) : (
            <Button variant="primary" disabled={pending || status === "loading"} onClick={enable}>
              <Bell className="size-4" /> Enable notifications
            </Button>
          )}
        </div>
      )}
      {!vapidKey && (
        <p className="mt-3 text-xs text-warn">Server setup needed: set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (see README).</p>
      )}
    </Card>
  );
}

function Export() {
  const links = [
    { href: "/api/export?format=json", label: "Everything (JSON)" },
    { href: "/api/export?format=csv&type=habit_logs", label: "Habit check-ins (CSV)" },
    { href: "/api/export?format=csv&type=habits", label: "Habits (CSV)" },
    { href: "/api/export?format=csv&type=tasks", label: "Tasks (CSV)" },
    { href: "/api/export?format=csv&type=journal", label: "Journal (CSV)" },
  ];
  return (
    <Card>
      <CardTitle sub="Download a copy of your data at any time">Export data</CardTitle>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            download
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2"
          >
            <Download className="size-4" aria-hidden /> {l.label}
          </a>
        ))}
      </div>
    </Card>
  );
}

function Password() {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardTitle>Change password</CardTitle>
      <form
        className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const form = e.currentTarget;
          start(async () => {
            const r = await changePassword(String(f.get("current")), String(f.get("next")));
            toast(r.ok ? (r.message ?? "Done") : r.error, r.ok ? "good" : "bad");
            if (r.ok) form.reset();
          });
        }}
      >
        <label className="block">
          <Label>Current password</Label>
          <Input name="current" type="password" required autoComplete="current-password" />
        </label>
        <label className="block">
          <Label>New password</Label>
          <Input name="next" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        <Button type="submit" disabled={pending}>
          Update
        </Button>
      </form>
    </Card>
  );
}

function Danger() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  return (
    <Card className="border-bad/30">
      <CardTitle>Account</CardTitle>
      <div className="flex flex-wrap gap-2">
        <form action={logout}>
          <Button type="submit">
            <LogOut className="size-4" /> Sign out
          </Button>
        </form>
        <Button variant="ghost" className="text-bad hover:bg-bad/10" onClick={() => setOpen(true)}>
          <Trash2 className="size-4" /> Delete account
        </Button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete account">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const pw = String(new FormData(e.currentTarget).get("password"));
            start(async () => {
              const r = await deleteAccount(pw);
              if (r && !r.ok) toast(r.error, "bad");
            });
          }}
        >
          <p className="text-sm text-text-2">
            This permanently deletes your account and all habits, tasks and journal entries. Export your data first if you want a copy.
          </p>
          <label className="block">
            <Label>Confirm with your password</Label>
            <Input name="password" type="password" required autoComplete="current-password" />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={pending}>
              Delete everything
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
