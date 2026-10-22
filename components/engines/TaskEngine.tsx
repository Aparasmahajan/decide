"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { pick } from "@/lib/random";
import { cn } from "@/lib/cn";

/** `picked` holds tasks taken out by "remove after picking", so they can be put back. */
type TaskConfig = { tasks: string[]; removeAfter: boolean; picked: string[] };
const DEFAULT: TaskConfig = {
  tasks: [
    "Do the dishes",
    "Take out the trash",
    "Reply to emails",
    "Go for a walk",
    "Tidy your desk",
  ],
  removeAfter: false,
  picked: [],
};

/** Total length of the shuffle, and how many tasks it flicks through on the way. */
const REEL_MS = 1600;
const REEL_TICKS = 16;

export default function TaskEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<TaskConfig>(DEFAULT);
  /*
   * The textarea edits its own raw text; the task list is derived from it.
   * Binding it to `tasks.join("\n")` re-trimmed every line on every keystroke,
   * so the space you just typed after "Do" vanished — multi-word tasks could
   * not be typed at all — and Enter at the end of the list did nothing.
   */
  const [draft, setDraft] = useState(DEFAULT.tasks.join("\n"));
  const [current, setCurrent] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  /* Bumped per pick so the landing animation replays even for a repeat task. */
  const [round, setRound] = useState(0);
  const reduce = useReducedMotion();

  /* Latest config for code that runs after the shuffle (see NameEngine). */
  const cfgRef = useRef(DEFAULT);
  const reelRef = useRef<HTMLDivElement>(null);
  const rollRef = useRef<{ frames: string[]; winner: string } | null>(null);

  useEffect(() => {
    const stored = readConfig<TaskConfig>(engine.slug, DEFAULT);
    const next = {
      ...stored,
      tasks: parseTasks(lines(stored.tasks)).tasks,
      picked: listOf(stored.picked),
    };
    cfgRef.current = next;
    setCfg(next);
    setDraft(next.tasks.join("\n"));
  }, [engine.slug]);

  const save = (next: TaskConfig) => {
    cfgRef.current = next;
    setCfg(next);
    writeConfig(engine.slug, next);
  };
  const persist = (patch: Partial<TaskConfig>) =>
    save({ ...cfgRef.current, ...patch });

  const { dupes } = useMemo(() => parseTasks(draft), [draft]);

  const editTasks = (text: string) => {
    setDraft(text);
    persist({ tasks: parseTasks(text).tasks });
  };

  const land = (winner: string) => {
    rollRef.current = null;
    setRolling(false);
    setCurrent(winner);
    setRound((r) => r + 1);
    pushHistory({ engineId: engine.slug, outcome: winner });
    const c = cfgRef.current;
    if (c.removeAfter) {
      const tasks = c.tasks.filter((t) => t !== winner);
      save({ ...c, tasks, picked: [...c.picked, winner] });
      setDraft(tasks.join("\n"));
    }
  };

  const roll = () => {
    const pool = cfgRef.current.tasks;
    // A ref, not `rolling`: two clicks inside one frame both still see `false`.
    if (rollRef.current || pool.length === 0) return;
    const winner = pick(pool);
    const frames = reduce ? [] : reelFrames(pool, winner, REEL_TICKS);
    if (frames.length === 0) return land(winner);
    rollRef.current = { frames, winner };
    setRolling(true);
  };

  /* Layout effect: first frame lands before paint; cleanup cancels on unmount. */
  useLayoutEffect(() => {
    const r = rollRef.current;
    if (!rolling || !r) return;
    return playReel(reelRef.current, r.frames, REEL_MS, () => land(r.winner));
    // `land` only touches refs and setters, so the first render's copy is fine.
  }, [rolling]); // eslint-disable-line react-hooks/exhaustive-deps

  const restore = () => {
    const c = cfgRef.current;
    const tasks = parseTasks([...c.tasks, ...c.picked].join("\n")).tasks;
    save({ ...c, tasks, picked: [] });
    setDraft(tasks.join("\n"));
  };

  const empty = cfg.tasks.length === 0;
  const exhausted = empty && cfg.picked.length > 0;

  return (
    <EngineShell
      engine={engine}
      variant="cool"
      side={
        <>
          <SidePanel title="Tasks">
            <textarea
              value={draft}
              onChange={(e) => editTasks(e.target.value)}
              readOnly={rolling}
              rows={10}
              placeholder="One task per line"
              aria-label="Tasks"
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-white/25"
            />
            <div className="mt-2 text-[11px] text-white/40">
              {cfg.tasks.length} {cfg.tasks.length === 1 ? "task" : "tasks"} in
              the pool
              {dupes > 0 && ` · ${dupes} duplicate${dupes === 1 ? "" : "s"} ignored`}
            </div>
          </SidePanel>
          <SidePanel title="Modes">
            <label className="flex items-center justify-between text-sm text-white/80">
              <span>Remove after picking</span>
              <input
                type="checkbox"
                checked={cfg.removeAfter}
                onChange={(e) => persist({ removeAfter: e.target.checked })}
                className="h-4 w-4 accent-sky-400"
              />
            </label>
            {cfg.picked.length > 0 && (
              <button
                onClick={restore}
                disabled={rolling}
                className="mt-3 w-full rounded-lg border border-dashed border-white/15 py-2 text-sm text-white/60 hover:border-white/30 hover:text-white/90 disabled:opacity-50"
              >
                Put back {cfg.picked.length} done
              </button>
            )}
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          {exhausted ? "All tasks picked" : "Your next task is…"}
        </p>
        {/* Fixed min-height so neither the reel nor a wrapped task moves the button. */}
        <div
          className="grid min-h-[10rem] w-full flex-1 place-items-center sm:min-h-[12rem]"
          aria-live="polite"
        >
          {rolling ? (
            <div ref={reelRef} aria-hidden className={taskClass("")} />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={current === null ? "idle" : round}
                initial={reduce ? false : { y: 24, opacity: 0, scale: 0.96 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 320,
                  damping: 22,
                  opacity: { duration: 0.15 },
                }}
                className={taskClass(current ?? "—")}
              >
                {current ?? "—"}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
        {exhausted ? (
          <BigActionButton
            label={cfg.picked.length === 1 ? "Put it back" : `Put all ${cfg.picked.length} back`}
            onClick={restore}
            color="#22c55e"
            color2="#0ea5e9"
          />
        ) : (
          <BigActionButton
            label={rolling ? "Choosing…" : empty ? "Add some tasks" : "Pick a task"}
            onClick={roll}
            disabled={rolling || empty}
            color="#22c55e"
            color2="#0ea5e9"
          />
        )}
      </div>
    </EngineShell>
  );
}

/* ---------------- helpers ---------------- */

/** Stored lists, tolerating hand-edited storage where the field isn't an array. */
const listOf = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const lines = (v: unknown) => listOf(v).join("\n");

/**
 * One task per line (tasks are sentences, so commas stay), trimmed, blanks
 * dropped. Repeats are dropped case-insensitively: a duplicate silently doubled
 * its odds, and "remove after picking" took out every copy at once.
 */
function parseTasks(text: string): { tasks: string[]; dupes: number } {
  const seen = new Set<string>();
  const tasks: string[] = [];
  let dupes = 0;
  for (const raw of text.split("\n")) {
    const task = raw.trim();
    if (!task) continue;
    const k = task.toLocaleLowerCase();
    if (seen.has(k)) {
      dupes++;
      continue;
    }
    seen.add(k);
    tasks.push(task);
  }
  return { tasks, dupes };
}

/** Steps the size down for long tasks so they wrap to two or three lines, not five. */
function taskClass(text: string) {
  const size =
    text.length <= 16
      ? "text-4xl sm:text-6xl"
      : text.length <= 40
        ? "text-3xl sm:text-5xl"
        : "text-2xl sm:text-4xl";
  // Size first: tailwind-merge drops a `leading-*` that precedes a font size.
  return cn(
    size,
    "max-w-full px-6 text-center font-black leading-tight tracking-tight text-gradient [overflow-wrap:anywhere]",
  );
}

/**
 * The tasks the reel flicks through, built backwards from the winner: none
 * shows twice in a row and the last frame is never the winner itself.
 */
function reelFrames(pool: string[], winner: string, count: number): string[] {
  if (pool.length < 2) return [];
  const frames: string[] = new Array(count);
  let next = winner;
  for (let i = count - 1; i >= 0; i--) {
    next = pick(pool.filter((t) => t !== next));
    frames[i] = next;
  }
  return frames;
}

/*
 * The shuffle. Same approach as NameEngine: the old 85ms `setInterval` set
 * state on the engine every tick, re-rendering the whole page and re-keying a
 * blur-animated AnimatePresence child faster than its own exit could finish.
 * Frames are now written straight into one node with a compositor-only nudge,
 * so React renders only when the shuffle starts and when it lands. Gaps grow
 * so the reel slows into the result. Returns a cancel function.
 */
function playReel(
  el: HTMLElement | null,
  frames: string[],
  totalMs: number,
  onDone: () => void,
) {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const last = Math.max(1, frames.length - 1);
  const weights = frames.map((_, i) => 1 + 3 * (i / last) ** 2);
  const unit = totalMs / weights.reduce((a, b) => a + b, 0);
  let t = 0;
  frames.forEach((value, i) => {
    const gap = weights[i] * unit;
    const show = () => {
      if (!el) return;
      el.textContent = value;
      el.className = taskClass(value);
      el.animate?.(
        [
          { transform: "translateY(14%)", opacity: 0.4 },
          { transform: "none", opacity: 1 },
        ],
        { duration: Math.min(gap, 140), easing: "ease-out" },
      );
    };
    if (i === 0) show();
    else timers.push(setTimeout(show, t));
    t += gap;
  });
  timers.push(setTimeout(onDone, t));
  return () => timers.forEach(clearTimeout);
}
