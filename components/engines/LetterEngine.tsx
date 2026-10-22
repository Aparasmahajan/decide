"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { pick, randomInt } from "@/lib/random";

type Alphabet = "en" | "vowels" | "consonants" | "custom";
type LetterConfig = { alphabet: Alphabet; custom: string; uppercase: boolean };
const DEFAULT: LetterConfig = {
  alphabet: "en",
  custom: "ABCDEFG",
  uppercase: true,
};

const SETS: Record<Alphabet, string> = {
  en: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  vowels: "AEIOU",
  consonants: "BCDFGHJKLMNPQRSTVWXYZ",
  custom: "",
};
const ALPHABETS = Object.keys(SETS) as Alphabet[];

/** The whole pick, first flicker to reveal. */
const ROLL_MS = 900;
/** How often the letter changes while picking. */
const FLICKER_MS = 60;

const GLYPH =
  "text-[280px] font-black leading-none tracking-tighter text-gradient";
/** Every state shares one grid cell, so an exit and an entrance overlap in place. */
const CELL = { gridArea: "1 / 1" } as const;

/** Stored configs can be stale or hand-edited; an unknown alphabet crashed the page. */
function sanitize(c: LetterConfig): LetterConfig {
  return {
    alphabet: ALPHABETS.includes(c.alphabet) ? c.alphabet : DEFAULT.alphabet,
    custom: typeof c.custom === "string" ? c.custom : DEFAULT.custom,
    uppercase: typeof c.uppercase === "boolean" ? c.uppercase : DEFAULT.uppercase,
  };
}

/**
 * User-perceived characters. `split("")` cuts by UTF-16 unit, so an accented
 * letter typed as base + combining mark, or anything outside the BMP, came out
 * as two broken halves.
 */
function graphemes(s: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return Array.from(new Intl.Segmenter().segment(s), (g) => g.segment);
  }
  return Array.from(s);
}

/**
 * The letters that can actually come up, already in the chosen case. Case is
 * applied here — not only to the final pick — so the flicker shows lowercase
 * when the result will be lowercase, and "aA" with uppercase on is one letter,
 * not a double-weighted A.
 */
function buildPool(cfg: LetterConfig): string[] {
  const source = cfg.alphabet === "custom" ? cfg.custom : SETS[cfg.alphabet];
  const out = new Set<string>();
  for (const ch of graphemes(source)) {
    if (!ch.trim()) continue;
    const cased = cfg.uppercase ? ch.toUpperCase() : ch.toLowerCase();
    // "ß".toUpperCase() is "SS": keep such letters as typed, not as two.
    out.add(graphemes(cased).length === 1 ? cased : ch);
  }
  return Array.from(out);
}

export default function LetterEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<LetterConfig>(DEFAULT);
  const [letter, setLetter] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  /** Bumped per pick so the reveal replays even when the letter repeats. */
  const [round, setRound] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCfg(sanitize(readConfig<LetterConfig>(engine.slug, DEFAULT)));
  }, [engine.slug]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const persist = (patch: Partial<LetterConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  const pool = useMemo(() => buildPool(cfg), [cfg]);
  const empty = pool.length === 0;

  const spin = () => {
    if (rolling || empty) return;
    const l = pick(pool);
    setRolling(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setLetter(l);
      setRound((r) => r + 1);
      setRolling(false);
      pushHistory({ engineId: engine.slug, outcome: l });
    }, ROLL_MS);
  };

  return (
    <EngineShell
      engine={engine}
      variant="warm"
      side={
        <>
          <SidePanel title="Alphabet">
            <div className="grid grid-cols-2 gap-2">
              {ALPHABETS.map((a) => (
                <button
                  key={a}
                  onClick={() => persist({ alphabet: a })}
                  disabled={rolling}
                  aria-pressed={cfg.alphabet === a}
                  className={
                    "rounded-xl px-3 py-2 text-sm capitalize transition-all disabled:cursor-not-allowed " +
                    (cfg.alphabet === a
                      ? "bg-white text-ink-950 shadow-glow"
                      : "bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white disabled:opacity-50")
                  }
                >
                  {a}
                </button>
              ))}
            </div>
            {cfg.alphabet === "custom" && (
              <>
                <input
                  value={cfg.custom}
                  onChange={(e) => persist({ custom: e.target.value })}
                  disabled={rolling}
                  maxLength={100}
                  placeholder="Letters to pick from, e.g. ABCXYZ"
                  aria-label="Custom letters"
                  className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-mono text-white outline-none focus:border-white/25 disabled:opacity-60"
                />
                {empty && (
                  <p className="mt-2 text-xs text-white/50">
                    Type at least one letter to pick from.
                  </p>
                )}
              </>
            )}
          </SidePanel>
          <SidePanel title="Case">
            <label className="flex items-center justify-between text-sm text-white/80">
              <span>Uppercase</span>
              <input
                type="checkbox"
                checked={cfg.uppercase}
                onChange={(e) => persist({ uppercase: e.target.checked })}
                disabled={rolling}
                className="h-4 w-4 accent-fuchsia-400"
              />
            </label>
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-10">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          Random letter
        </p>
        {/*
          The flicker used to be keyed by the letter inside a `mode="wait"`
          AnimatePresence: a new key every 60ms, each held back until the
          previous one's spring exit had finished, so most picks never showed,
          the stage sat mid-fade and the final letter surfaced after the result
          was recorded. Now the flicker is one element that swaps its text;
          only the result flips in.
        */}
        <div className="grid flex-1 place-items-center">
          <AnimatePresence>
            {rolling ? (
              <Flicker key="flicker" pool={pool} />
            ) : (
              <motion.div
                key={round}
                initial={{ y: 40, opacity: 0, rotateX: 90 }}
                animate={{ y: 0, opacity: 1, rotateX: 0 }}
                exit={{
                  y: -40,
                  opacity: 0,
                  rotateX: -90,
                  transition: { duration: 0.15 },
                }}
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
                className={GLYPH}
                style={CELL}
              >
                {letter ?? "?"}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <BigActionButton
          label={
            rolling ? "Choosing…" : empty ? "Add letters first" : "Pick a letter"
          }
          onClick={spin}
          disabled={rolling || empty}
          color="#f43f5e"
          color2="#8b5cf6"
        />
      </div>
    </EngineShell>
  );
}

/** Cycles through the pool while picking; re-renders itself, not the page. */
function Flicker({ pool }: { pool: string[] }) {
  // Only ever mounted after a click, so a random start can't mismatch SSR.
  const [i, setI] = useState(() => randomInt(0, pool.length - 1));

  useEffect(() => {
    const n = pool.length;
    // Always step to a *different* letter, so the flicker never looks stuck.
    const id = setInterval(
      () => setI((prev) => (prev + randomInt(1, Math.max(1, n - 1))) % n),
      FLICKER_MS,
    );
    return () => clearInterval(id);
  }, [pool.length]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
      className={GLYPH}
      style={CELL}
    >
      {pool[i % pool.length]}
    </motion.div>
  );
}
