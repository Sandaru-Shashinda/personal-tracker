"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

/**
 * Shown when a page fails to load, most often because the connection to the database dropped
 * for longer than lib/db's automatic retries cover. Retrying re-fetches the page from the server.
 */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  // Try again by itself as soon as the device reports it's back online.
  useEffect(() => {
    const onOnline = () => retry();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [retry]);

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface shadow-card px-6 py-16 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-warn/10 text-warn">
        <WifiOff className="size-6" aria-hidden />
      </span>
      <h2 className="text-lg font-semibold">Couldn&apos;t load this page</h2>
      <p className="mt-1 max-w-sm text-sm text-text-3">
        The connection dropped while loading your data. Your saved data is safe. Check your internet and try again.
      </p>
      <Button
        variant="primary"
        className="mt-5"
        disabled={retrying}
        onClick={() => {
          setRetrying(true);
          retry();
          setTimeout(() => setRetrying(false), 1500);
        }}
      >
        <RefreshCw className={retrying ? "size-4 animate-spin" : "size-4"} /> Try again
      </Button>
    </div>
  );
}
