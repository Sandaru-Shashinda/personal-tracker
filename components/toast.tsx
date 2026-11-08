"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";

type Toast = { id: number; message: string; tone: "good" | "bad" };
const ToastCtx = createContext<(message: string, tone?: "good" | "bad") => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: "good" | "bad" = "good") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        // Phones: top of the screen, clear of the tab bar, the FAB and the keyboard. Desktop: bottom center.
        className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[100] flex flex-col items-center gap-2 px-4 md:top-auto md:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="backdrop-in pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-medium shadow-lg"
          >
            {t.tone === "good" ? (
              <CheckCircle2 className="size-4 text-good" aria-hidden />
            ) : (
              <XCircle className="size-4 text-bad" aria-hidden />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
