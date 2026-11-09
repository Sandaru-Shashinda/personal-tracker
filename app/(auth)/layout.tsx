import { Target } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="animate-rise w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="bg-brand mb-4 flex size-14 items-center justify-center rounded-2xl shadow-xl shadow-accent/35">
            <Target className="size-7" aria-hidden />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Tracker</h1>
          <p className="mt-1 text-sm text-text-3">Habits, tasks, goals and mood, all in one place.</p>
        </div>
        <div className="rounded-3xl border border-border bg-surface/90 p-6 shadow-xl shadow-accent/10 backdrop-blur-xl sm:p-7">{children}</div>
      </div>
    </main>
  );
}
