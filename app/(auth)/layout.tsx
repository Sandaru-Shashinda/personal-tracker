import { Target } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-fg">
            <Target className="size-6" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Tracker</h1>
          <p className="mt-1 text-sm text-text-3">Habits, tasks, goals and mood, all in one place.</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">{children}</div>
      </div>
    </main>
  );
}
