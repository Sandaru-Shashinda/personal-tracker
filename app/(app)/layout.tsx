import { LogOut } from "lucide-react";
import { Suspense } from "react";
import { MobileHeader, MobileNav, Sidebar } from "@/components/nav";
import { getSession } from "@/lib/auth";
import { logout } from "@/lib/actions/auth";

async function UserBadge() {
  const session = await getSession();
  if (!session) return null;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-text-2">
        {session.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium" title={session.email}>
        {session.name}
      </span>
      <form action={logout}>
        <button
          type="submit"
          className="flex size-8 items-center justify-center rounded-lg text-text-3 hover:bg-surface-2 hover:text-text"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar
        userSlot={
          <Suspense fallback={<div className="h-8 flex-1" />}>
            <UserBadge />
          </Suspense>
        }
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 sm:px-6 md:pb-10 md:pt-8">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
