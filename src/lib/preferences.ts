"use client";

import { useSyncExternalStore } from "react";

/*
 * Device preferences, stored in this browser only (localStorage).
 * Every read and write is guarded: storage can be unavailable in private modes,
 * in which case the default is used and the app keeps working.
 */

export const PREFERENCES_EVENT = "herbody-preferences-updated";

/** Shared with the sidebar collapse button. */
export const SIDEBAR_COLLAPSED_KEY = "herbody:sidebar-collapsed";
const SIDEBAR_EVENT = "herbody-sidebar-preference";

export type WeekStart = 0 | 1;

const KEYS = {
  weekStartsOn: "herbody:week-starts-on",
  reduceMotion: "herbody:reduce-motion",
} as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null, event = PREFERENCES_EVENT): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Not saved (storage unavailable); the current page still updates below.
  }
  window.dispatchEvent(new Event(event));
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(PREFERENCES_EVENT, callback);
  window.addEventListener(SIDEBAR_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(PREFERENCES_EVENT, callback);
    window.removeEventListener(SIDEBAR_EVENT, callback);
  };
}

export const getWeekStartsOn = (): WeekStart => (read(KEYS.weekStartsOn) === "1" ? 1 : 0);
export const getReduceMotion = (): boolean => read(KEYS.reduceMotion) === "true";
export const getSidebarCollapsed = (): boolean => read(SIDEBAR_COLLAPSED_KEY) === "true";

export const setWeekStartsOn = (value: WeekStart) => write(KEYS.weekStartsOn, String(value));
export const setReduceMotion = (value: boolean) => write(KEYS.reduceMotion, String(value));
export const setSidebarCollapsed = (value: boolean) => write(SIDEBAR_COLLAPSED_KEY, String(value), SIDEBAR_EVENT);

/** Removes every saved preference on this device (sign-in is not affected). */
export function resetPreferences(): void {
  for (const key of [...Object.values(KEYS), SIDEBAR_COLLAPSED_KEY]) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing stored.
    }
  }
  window.dispatchEvent(new Event(PREFERENCES_EVENT));
  window.dispatchEvent(new Event(SIDEBAR_EVENT));
}

export function useWeekStartsOn(): WeekStart {
  return useSyncExternalStore<WeekStart>(subscribe, getWeekStartsOn, () => 0);
}

export function useReduceMotion(): boolean {
  return useSyncExternalStore(subscribe, getReduceMotion, () => false);
}

export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(subscribe, getSidebarCollapsed, () => false);
}
