"use client";

const isBrowser = typeof window !== "undefined";

type Storage = "local" | "session";

function getStore(kind: Storage): globalThis.Storage | null {
  if (!isBrowser) return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readStore<T>(key: string, fallback: T, kind: Storage = "local"): T {
  const s = getStore(kind);
  if (!s) return fallback;
  try {
    const raw = s.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStore<T>(key: string, value: T, kind: Storage = "local") {
  const s = getStore(kind);
  if (!s) return;
  try {
    s.setItem(key, JSON.stringify(value));
  } catch {
    /* quota */
  }
}

export function removeStore(key: string, kind: Storage = "local") {
  const s = getStore(kind);
  if (!s) return;
  try {
    s.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* ---------- History ---------- */

export type HistoryEntry = {
  id: string;
  engineId: string;
  outcome: string;
  meta?: Record<string, unknown>;
  timestamp: number;
};

const HISTORY_KEY = "decide.history.v1";
const MAX_HISTORY = 200;

export function pushHistory(entry: Omit<HistoryEntry, "id" | "timestamp">) {
  const items = readStore<HistoryEntry[]>(HISTORY_KEY, []);
  const next: HistoryEntry = {
    ...entry,
    id: Math.random().toString(36).slice(2, 10),
    timestamp: Date.now(),
  };
  items.unshift(next);
  if (items.length > MAX_HISTORY) items.length = MAX_HISTORY;
  writeStore(HISTORY_KEY, items);
  return next;
}

export function readHistory(engineId?: string): HistoryEntry[] {
  const items = readStore<HistoryEntry[]>(HISTORY_KEY, []);
  return engineId ? items.filter((i) => i.engineId === engineId) : items;
}

export function clearHistory(engineId?: string) {
  if (!engineId) {
    removeStore(HISTORY_KEY);
    return;
  }
  const items = readStore<HistoryEntry[]>(HISTORY_KEY, []).filter(
    (i) => i.engineId !== engineId,
  );
  writeStore(HISTORY_KEY, items);
}

/* ---------- Config per engine ---------- */

export function readConfig<T>(engineId: string, fallback: T): T {
  return readStore<T>(`decide.config.${engineId}.v1`, fallback);
}

export function writeConfig<T>(engineId: string, value: T) {
  writeStore(`decide.config.${engineId}.v1`, value);
}
