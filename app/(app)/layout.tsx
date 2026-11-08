import { LogOut } from "lucide-react";
import { Suspense } from "react";
import { MobileNav, Sidebar } from "@/components/nav";
import { getSession } from "@/lib/auth";
import { logout } from "@/lib/actions/auth";

async function UserBadge() {
  const session = await getSession();
  if (!session) return null;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-text-2 md:size-8">
        {session.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-medium" title={session.email}>
          {session.name}
        </span>
        <span className="block truncate text-xs text-text-3 md:hidden">{session.email}</span>
      </span>
      <form action={logout}>
        <button
          type="submit"
          className="flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium text-text-2 hover:bg-surface-2 hover:text-text active:bg-surface-2 md:size-8 md:px-0 md:text-text-3"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-4" aria-hidden />
          <span className="md:hidden">Sign out</span>
        </button>
      </form>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const user = (
    <Suspense fallback={<div className="h-9 flex-1" />}>
      <UserBadge />
    </Suspense>
  );
  return (
    <div className="flex min-h-dvh">
      <Sidebar userSlot={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phones: no top bar (the page title is the header), so pad for the notch and for the tab bar + FAB. */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-[max(1.25rem,calc(env(safe-area-inset-top)+0.75rem))] pb-[calc(8.5rem+env(safe-area-inset-bottom))] sm:px-6 md:pt-8 md:pb-10">
          {children}
        </main>
      </div>
      <MobileNav userSlot={user} />
    </div>
  );
}
