"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

let zonesCache: string[] | null = null;
function allZones(): string[] {
  if (!zonesCache) {
    try {
      zonesCache = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
    } catch {
      zonesCache = [];
    }
  }
  return zonesCache;
}
const EMPTY: string[] = [];

/** The browser's IANA timezone (null during SSR). */
export function useDeviceTimezone(): string | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    () => null,
  );
}

/** All IANA timezones the browser knows (empty during SSR). */
export function useTimezoneList(): string[] {
  return useSyncExternalStore(noopSubscribe, allZones, () => EMPTY);
}
