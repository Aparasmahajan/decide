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

/** `picked` holds names taken out by "remove after selection", so they can be put back. */
type NameConfig = { names: string[]; removeAfter: boolean; picked: string[] };
const DEFAULT: NameConfig = {
  names: ["Ada", "Grace", "Alan", "Linus", "Margaret"],
  removeAfter: false,
  picked: [],
};

/** Total length of the shuffle, and how many names it flicks through on the way. */
const REEL_MS = 1700;
const REEL_TICKS = 18;

export default function NameEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<NameConfig>(DEFAULT);
  /*
   * The textarea edits its own raw text; the name list is derived from it.
   * Binding the textarea to `names.join("\n")` re-trimmed and re-joined the
   * text on every keystroke, which swallowed the space in "Mary Jane" and any
   * Enter at the end of the list, and kicked the caret to the end.
   */
  const [draft, setDraft] = useState(DEFAULT.names.join("\n"));
  const [current, setCurrent] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  /* Bumped per pick so the landing animation replays even for a repeat winner. */
  const [round, setRound] = useState(0);
  const reduce = useReducedMotion();

  /*
   * The latest config, for code that runs after the shuffle. Reading `cfg` from
   * the click handler's closure there would write back a stale list and drop any
   * edit made in the meantime.
   */
  const cfgRef = useRef(DEFAULT);
  const reelRef = useRef<HTMLDivElement>(null);
  const rollRef = useRef<{ frames: string[]; winner: string } | null>(null);

  useEffect(() => {
    const stored = readConfig<NameConfig>(engine.slug, DEFAULT);
    const next = {
      ...stored,
      names: parseNames(lines(stored.names)).names,
      picked: listOf(stored.picked),
    };
    cfgRef.current = next;
    setCfg(next);
    setDraft(next.names.join("\n"));
  }, [engine.slug]);

  const save = (next: NameConfig) => {
    cfgRef.current = next;
    setCfg(next);
    writeConfig(engine.slug, next);
  };
  const persist = (patch: Partial<NameConfig>) =>
    save({ ...cfgRef.current, ...patch });

  const { dupes } = useMemo(() => parseNames(draft), [draft]);

  const editNames = (text: string) => {
    setDraft(text);
    persist({ names: parseNames(text).names });
  };

  const land = (winner: string) => {
    rollRef.current = null;
    setRolling(false);
    setCurrent(winner);
    setRound((r) => r + 1);
    pushHistory({ engineId: engine.slug, outcome: winner });
    const c = cfgRef.current;
    if (c.removeAfter) {
      const names = c.names.filter((n) => n !== winner);
      save({ ...c, names, picked: [...c.picked, winner] });
      setDraft(names.join("\n"));
    }
  };

  const pickWinner = () => {
    const pool = cfgRef.current.names;
    // A ref, not `rolling`: two clicks inside one frame both still see `false`.
    if (rollRef.current || pool.length === 0) return;
    const winner = pick(pool);
    const frames = reduce ? [] : reelFrames(pool, winner, REEL_TICKS);
    if (frames.length === 0) return land(winner);
    rollRef.current = { frames, winner };
    setRolling(true);
  };

  /*
   * Layout effect so the first frame is written before the browser paints the
   * (still empty) reel. The cleanup cancels the reel on unmount, so leaving the
   * page mid-shuffle no longer sets state or saves a pick nobody saw.
   */
  useLayoutEffect(() => {
    const roll = rollRef.current;
    if (!rolling || !roll) return;
    return playReel(reelRef.current, roll.frames, REEL_MS, () =>
      land(roll.winner),
    );
    // `land` only touches refs and setters, so the first render's copy is fine.
  }, [rolling]); // eslint-disable-line react-hooks/exhaustive-deps

  const restore = () => {
    const c = cfgRef.current;
    const names = parseNames([...c.names, ...c.picked].join("\n")).names;
    save({ ...c, names, picked: [] });
    setDraft(names.join("\n"));
  };

  const empty = cfg.names.length === 0;
  const exhausted = empty && cfg.picked.length > 0;

  return (
    <EngineShell
      engine={engine}
      variant="warm"
      side={
        <>
          <SidePanel title="Names">
            <textarea
              value={draft}
              onChange={(e) => editNames(e.target.value)}
              readOnly={rolling}
              rows={10}
              placeholder="One name per line or CSV"
              aria-label="Names"
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-white/25"
            />
            <div className="mt-2 text-[11px] text-white/40">
              {cfg.names.length} {cfg.names.length === 1 ? "name" : "names"}{" "}
              loaded
              {dupes > 0 && ` · ${dupes} duplicate${dupes === 1 ? "" : "s"} ignored`}
            </div>
          </SidePanel>
          <SidePanel title="Modes">
            <label className="flex items-center justify-between text-sm text-white/80">
              <span>Remove after selection</span>
              <input
                type="checkbox"
                checked={cfg.removeAfter}
                onChange={(e) => persist({ removeAfter: e.target.checked })}
                className="h-4 w-4 accent-fuchsia-400"
              />
            </label>
            {cfg.picked.length > 0 && (
              <button
                onClick={restore}
                disabled={rolling}
                className="mt-3 w-full rounded-lg border border-dashed border-white/15 py-2 text-sm text-white/60 hover:border-white/30 hover:text-white/90 disabled:opacity-50"
              >
                Put back {cfg.picked.length} picked
              </button>
            )}
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          {exhausted ? "Everyone's been picked" : "Pick a winner"}
        </p>
        {/* Fixed min-height so neither the reel nor a wrapped name moves the button. */}
        <div
          className="grid min-h-[9rem] w-full flex-1 place-items-center sm:min-h-[11rem]"
          aria-live="polite"
        >
          {rolling ? (
            <div ref={reelRef} aria-hidden className={nameClass("")} />
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
                className={nameClass(current ?? "—")}
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
            color="#f97316"
            color2="#ef4444"
          />
        ) : (
          <BigActionButton
            label={rolling ? "Choosing…" : empty ? "Add some names" : "Pick winner"}
            onClick={pickWinner}
            disabled={rolling || empty}
            color="#f97316"
            color2="#ef4444"
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
 * One entry per line or comma, trimmed, blanks dropped. Repeats are dropped
 * case-insensitively ("ana" and "Ana" are one person): a duplicate would get
 * twice the odds, and "remove after selection" would take out both at once.
 */
function parseNames(text: string): { names: string[]; dupes: number } {
  const seen = new Set<string>();
  const names: string[] = [];
  let dupes = 0;
  for (const raw of text.split(/[\n,]/)) {
    const name = raw.trim();
    if (!name) continue;
    const k = name.toLocaleLowerCase();
    if (seen.has(k)) {
      dupes++;
      continue;
    }
    seen.add(k);
    names.push(name);
  }
  return { names, dupes };
}

/**
 * Big for short names, stepping down for long ones so they wrap onto a line or
 * two instead of being cut off — the old single 72px size truncated "Margaret"
 * on a phone.
 */
function nameClass(text: string) {
  const size =
    text.length <= 6
      ? "text-[64px] sm:text-[88px] lg:text-[96px]"
      : text.length <= 12
        ? "text-4xl sm:text-6xl lg:text-7xl"
        : "text-3xl sm:text-4xl lg:text-5xl";
  // Size first: tailwind-merge drops a `leading-*` that precedes a font size.
  return cn(
    size,
    "max-w-full px-6 text-center font-black leading-[1.1] tracking-tighter text-gradient [overflow-wrap:anywhere]",
  );
}

/**
 * The names the reel flicks through, built backwards from the winner: no name
 * shows twice in a row, and the last frame is never the winner itself, so the
 * landing always reads as a change. Empty when there is nothing to shuffle.
 */
function reelFrames(pool: string[], winner: string, count: number): string[] {
  if (pool.length < 2) return [];
  const frames: string[] = new Array(count);
  let next = winner;
  for (let i = count - 1; i >= 0; i--) {
    next = pick(pool.filter((n) => n !== next));
    frames[i] = next;
  }
  return frames;
}

/*
 * The shuffle.
 *
 * This used to be an 80ms `setInterval` calling `setState` on the engine. Every
 * tick re-rendered the whole page — shell, aurora, particles, both side panels —
 * and re-keyed an AnimatePresence child whose 150ms exit plus 150ms enter could
 * never finish before the next tick, so `mode="wait"` dropped and stacked
 * frames. Each of those frames also animated `filter: blur()` on 96px gradient
 * text, which repaints the whole glyph run every frame. That was the stutter.
 *
 * Now the winner is drawn first, the frames are written straight into one DOM
 * node, and each gets a short transform/opacity nudge through the Web
 * Animations API (compositor-only). React renders twice per pick: when the
 * shuffle starts and when it lands. Gaps grow quadratically so the reel visibly
 * slows into the result. Returns a cancel function.
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
      el.className = nameClass(value);
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
