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

/**
 * Fired on `window` whenever this tab changes the history. Views that show
 * history (the engine shell's panel and badge, the history page) listen for
 * it — before this they only re-read on remount, so the panel showed stale
 * outcomes right after a flip, spin or roll.
 */
const HISTORY_EVENT = "decide:history";

function notifyHistory() {
  if (isBrowser) window.dispatchEvent(new Event(HISTORY_EVENT));
}

/**
 * Subscribe to history changes made in this tab, and in other tabs (via the
 * native `storage` event). Returns the unsubscribe function.
 */
export function subscribeHistory(cb: () => void): () => void {
  if (!isBrowser) return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === HISTORY_KEY) cb();
  };
  window.addEventListener(HISTORY_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(HISTORY_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function pushHistory(entry: Omit<HistoryEntry, "id" | "timestamp">) {
  const items = readHistory();
  const next: HistoryEntry = {
    ...entry,
    id: Math.random().toString(36).slice(2, 10),
    timestamp: Date.now(),
  };
  items.unshift(next);
  if (items.length > MAX_HISTORY) items.length = MAX_HISTORY;
  writeStore(HISTORY_KEY, items);
  notifyHistory();
  return next;
}

export function readHistory(engineId?: string): HistoryEntry[] {
  const raw = readStore<unknown>(HISTORY_KEY, []);
  const items = Array.isArray(raw) ? (raw as HistoryEntry[]) : [];
  return engineId ? items.filter((i) => i.engineId === engineId) : items;
}

export function clearHistory(engineId?: string) {
  if (!engineId) {
    removeStore(HISTORY_KEY);
  } else {
    writeStore(
      HISTORY_KEY,
      readHistory().filter((i) => i.engineId !== engineId),
    );
  }
  notifyHistory();
}

/* ---------- Config per engine ---------- */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Saved configs outlive the code that wrote them. When an engine gains an
 * option, configs saved before it existed come back without that field and the
 * engine reads `undefined` — a crash for anything like `SKINS[cfg.skin].face`.
 * Object configs are therefore shallow-merged over the defaults, and anything
 * whose shape doesn't match the default at all (hand-edited or corrupted
 * storage) falls back to the default.
 */
export function readConfig<T>(engineId: string, fallback: T): T {
  const stored = readStore<unknown>(`decide.config.${engineId}.v1`, fallback);
  if (isPlainObject(fallback)) {
    return (isPlainObject(stored) ? { ...fallback, ...stored } : fallback) as T;
  }
  if (Array.isArray(fallback)) {
    return (Array.isArray(stored) ? stored : fallback) as T;
  }
  return (typeof stored === typeof fallback ? stored : fallback) as T;
}

export function writeConfig<T>(engineId: string, value: T) {
  writeStore(`decide.config.${engineId}.v1`, value);
}
