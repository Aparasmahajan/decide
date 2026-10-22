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

/** `picked` holds objects taken out by "remove after picking", so they can be put back. */
type ObjectConfig = { objects: string[]; removeAfter: boolean; picked: string[] };
const DEFAULT: ObjectConfig = {
  objects: ["🍎", "📚", "🎸", "☕", "🔑", "🕯", "🧦", "🎧"],
  removeAfter: false,
  picked: [],
};

/** Total length of the shuffle, and how many objects it flicks through on the way. */
const REEL_MS = 1600;
const REEL_TICKS = 18;

export default function ObjectEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<ObjectConfig>(DEFAULT);
  /*
   * The textarea edits its own raw text; the object list is derived from it.
   * Binding it to `objects.join("\n")` re-trimmed every line per keystroke, so
   * a space could not be typed ("coffee mug" became "coffeemug") and Enter at
   * the end of the list did nothing.
   */
  const [draft, setDraft] = useState(DEFAULT.objects.join("\n"));
  const [current, setCurrent] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  /* Bumped per pick so the landing animation replays even for a repeat object. */
  const [round, setRound] = useState(0);
  const reduce = useReducedMotion();

  /* Latest config for code that runs after the shuffle (see NameEngine). */
  const cfgRef = useRef(DEFAULT);
  const reelRef = useRef<HTMLDivElement>(null);
  const rollRef = useRef<{ frames: string[]; winner: string } | null>(null);

  useEffect(() => {
    const stored = readConfig<ObjectConfig>(engine.slug, DEFAULT);
    const next = {
      ...stored,
      objects: parseObjects(lines(stored.objects)).objects,
      picked: listOf(stored.picked),
    };
    cfgRef.current = next;
    setCfg(next);
    setDraft(next.objects.join("\n"));
  }, [engine.slug]);

  const save = (next: ObjectConfig) => {
    cfgRef.current = next;
    setCfg(next);
    writeConfig(engine.slug, next);
  };
  const persist = (patch: Partial<ObjectConfig>) =>
    save({ ...cfgRef.current, ...patch });

  const { dupes } = useMemo(() => parseObjects(draft), [draft]);

  const editObjects = (text: string) => {
    setDraft(text);
    persist({ objects: parseObjects(text).objects });
  };

  const land = (winner: string) => {
    rollRef.current = null;
    setRolling(false);
    setCurrent(winner);
    setRound((r) => r + 1);
    pushHistory({ engineId: engine.slug, outcome: winner });
    const c = cfgRef.current;
    if (c.removeAfter) {
      const objects = c.objects.filter((o) => o !== winner);
      save({ ...c, objects, picked: [...c.picked, winner] });
      setDraft(objects.join("\n"));
    }
  };

  const roll = () => {
    const pool = cfgRef.current.objects;
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
    const objects = parseObjects([...c.objects, ...c.picked].join("\n")).objects;
    save({ ...c, objects, picked: [] });
    setDraft(objects.join("\n"));
  };

  const empty = cfg.objects.length === 0;
  const exhausted = empty && cfg.picked.length > 0;
  const shown = current ?? "—";
  const parts = splitLead(shown);

  return (
    <EngineShell
      engine={engine}
      variant="default"
      side={
        <>
          <SidePanel title="Objects">
            <textarea
              value={draft}
              onChange={(e) => editObjects(e.target.value)}
              readOnly={rolling}
              rows={10}
              placeholder="One object or emoji per line, or comma-separated"
              aria-label="Objects"
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-white/25"
            />
            <div className="mt-2 text-[11px] text-white/40">
              {cfg.objects.length} {cfg.objects.length === 1 ? "object" : "objects"}{" "}
              — emoji or text both work
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
                className="h-4 w-4 accent-slate-300"
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
          {exhausted ? "Every object picked" : "Pick an object"}
        </p>
        {/* Fixed min-height so switching between emoji and text never moves the button. */}
        <div
          className="grid min-h-[180px] w-full flex-1 place-items-center sm:min-h-[220px]"
          aria-live="polite"
        >
          {rolling ? (
            <div ref={reelRef} aria-hidden className={objectClass("")} />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={current === null ? "idle" : round}
                initial={reduce ? false : { scale: 0.6, opacity: 0, rotate: -8 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.6, opacity: 0, rotate: 8 }}
                /*
                 * A plain spring. The old `scale: [1, 1.12, 1]` keyframes under
                 * `type: "spring"` threw in development ("only two keyframes
                 * supported with spring") and silently did nothing in production;
                 * the spring's own overshoot from 0.6 already gives the pop.
                 */
                transition={{
                  type: "spring",
                  stiffness: 240,
                  damping: 16,
                  opacity: { duration: 0.15 },
                }}
                className={objectClass(shown)}
              >
                {isEmoji(shown) || !parts.rest ? (
                  shown
                ) : (
                  <>
                    {parts.lead && <span className="mr-3">{parts.lead}</span>}
                    <span className="text-gradient">{parts.rest}</span>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
        {exhausted ? (
          <BigActionButton
            label={cfg.picked.length === 1 ? "Put it back" : `Put all ${cfg.picked.length} back`}
            onClick={restore}
            color="#94a3b8"
            color2="#e2e8f0"
          />
        ) : (
          <BigActionButton
            label={rolling ? "Choosing…" : empty ? "Add some objects" : "Pick an object"}
            onClick={roll}
            disabled={rolling || empty}
            color="#94a3b8"
            color2="#e2e8f0"
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

/** One object per line or comma, trimmed, blanks and repeats dropped. */
function parseObjects(text: string): { objects: string[]; dupes: number } {
  const seen = new Set<string>();
  const objects: string[] = [];
  let dupes = 0;
  for (const raw of text.split(/[\n,]/)) {
    const obj = raw.trim();
    if (!obj) continue;
    const k = obj.toLocaleLowerCase();
    if (seen.has(k)) {
      dupes++;
      continue;
    }
    seen.add(k);
    objects.push(obj);
  }
  return { objects, dupes };
}

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/** User-perceived characters, so 👨‍👩‍👧 counts as one emoji rather than five code points. */
const graphemes = (s: string) =>
  segmenter ? Array.from(segmenter.segment(s), (g) => g.segment) : Array.from(s);

/*
 * `\p{Emoji}` (the old test) also matches the digits 0–9, `#` and `*`, so "42"
 * was blown up to 200px as if it were an emoji. Extended_Pictographic is the
 * property that actually means "renders as a picture"; flags are pairs of
 * regional indicators, and U+20E3 is the keycap combiner (1️⃣).
 */
const PICTO = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u;

/** Up to three emoji and nothing else. */
function isEmoji(s: string) {
  const g = graphemes(s).filter((c) => c.trim());
  return g.length > 0 && g.length <= 3 && g.every((c) => PICTO.test(c));
}

/**
 * Leading emoji split from the text after it. `text-gradient` paints the text
 * with a clipped background and a transparent fill, which turns a colour emoji
 * into a flat gradient silhouette — so "🎸 Guitar" renders the emoji outside it.
 */
function splitLead(s: string) {
  const g = graphemes(s);
  let i = 0;
  while (i < g.length && (PICTO.test(g[i]) || !g[i].trim())) i++;
  return { lead: g.slice(0, i).join("").trim(), rest: g.slice(i).join("").trim() };
}

function objectClass(s: string) {
  if (isEmoji(s)) {
    const one = graphemes(s).filter((c) => c.trim()).length === 1;
    // Size before `leading-*`: tailwind-merge drops a line-height that comes
    // before a font-size, since Tailwind's font sizes carry their own.
    return cn(
      // Three emoji at 160px is wider than a phone; step down for two or three.
      one ? "text-[160px] sm:text-[200px]" : "text-[72px] sm:text-[120px]",
      "leading-none drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)]",
    );
  }
  return cn(
    s.length <= 8
      ? "text-5xl sm:text-7xl"
      : s.length <= 20
        ? "text-4xl sm:text-6xl"
        : "text-3xl sm:text-5xl",
    "max-w-full px-6 text-center font-black leading-tight tracking-tight [overflow-wrap:anywhere]",
    // Pure-emoji runs too long to count as "big" keep their colours.
    splitLead(s).rest ? "" : "text-white",
  );
}

/** Mirrors the JSX in the landing view, for the reel's direct DOM writes. */
function paintObject(el: HTMLElement, value: string) {
  el.className = objectClass(value);
  const { lead, rest } = splitLead(value);
  if (isEmoji(value) || !rest) {
    el.textContent = value;
    return;
  }
  const text = document.createElement("span");
  text.className = "text-gradient";
  text.textContent = rest;
  if (!lead) return el.replaceChildren(text);
  const icon = document.createElement("span");
  icon.className = "mr-3";
  icon.textContent = lead;
  el.replaceChildren(icon, text);
}

/**
 * The objects the reel flicks through, built backwards from the winner: none
 * shows twice in a row and the last frame is never the winner itself.
 */
function reelFrames(pool: string[], winner: string, count: number): string[] {
  if (pool.length < 2) return [];
  const frames: string[] = new Array(count);
  let next = winner;
  for (let i = count - 1; i >= 0; i--) {
    next = pick(pool.filter((o) => o !== next));
    frames[i] = next;
  }
  return frames;
}

/*
 * The shuffle. Same approach as NameEngine: the old 75ms `setInterval` set
 * state on the engine every tick, re-rendering the whole page and re-keying a
 * spring-animated AnimatePresence child faster than its own exit could finish.
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
      paintObject(el, value);
      el.animate?.(
        [
          { transform: "scale(0.85)", opacity: 0.4 },
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
