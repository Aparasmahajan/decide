"use client";

import { motion, useMotionValue, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { randomInt } from "@/lib/random";

type NumberConfig = { min: number; max: number; unique: boolean };
const DEFAULT: NumberConfig = { min: 1, max: 100, unique: false };

/*
 * Bounds are clamped to twelve digits. Every integer in that range is exactly
 * representable, so `randomInt` stays uniform and inclusive at both ends, and
 * the widest possible result still fits the display at a legible size.
 */
const LIMIT = 999_999_999_999;

/*
 * "No repeats" enumerates the unused numbers when the range is small enough
 * to list. Past this size it switches to rejection sampling instead: building
 * a pool for 1–1,000,000,000 froze the tab, and with a range that wide the
 * chance of re-drawing a used number is negligible anyway.
 */
const POOL_MAX = 100_000;

const clampInt = (n: number) => Math.max(-LIMIT, Math.min(LIMIT, Math.round(n)));

/* Older or hand-edited configs can hold null/NaN bounds (NaN serialises to null). */
function normalize(c: NumberConfig): NumberConfig {
  return {
    min: Number.isFinite(c.min) ? clampInt(c.min) : DEFAULT.min,
    max: Number.isFinite(c.max) ? clampInt(c.max) : DEFAULT.max,
    unique: !!c.unique,
  };
}

export default function NumberEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<NumberConfig>(DEFAULT);
  const [value, setValue] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [seen, setSeen] = useState<Set<number>>(() => new Set());
  const timerRef = useRef<number | null>(null);
  const numRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  /*
   * The rolling digits are written through a motion value, not state. Each
   * tick used to `setValue`, which re-rendered the whole engine — EngineShell,
   * both side panels, the aurora and particle wrappers — up to 25 times a
   * second just to change one text node. A motion value child updates that
   * text node directly; React only renders at the start and end of a roll.
   */
  const display = useMotionValue("–");

  useEffect(() => {
    setCfg(normalize(readConfig<NumberConfig>(engine.slug, DEFAULT)));
  }, [engine.slug]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const persist = (patch: Partial<NumberConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  // Min above max is treated as the same range, not an error.
  const lo = Math.min(cfg.min, cfg.max);
  const hi = Math.max(cfg.min, cfg.max);
  const span = hi - lo + 1;

  /* Only numbers inside the current range count — the range can change between draws. */
  const usedInRange = useMemo(() => {
    let n = 0;
    seen.forEach((v) => {
      if (v >= lo && v <= hi) n++;
    });
    return n;
  }, [seen, lo, hi]);
  const exhausted = cfg.unique && usedInRange >= span;

  /*
   * A short compositor-only scale kick in step with each digit change. This
   * replaces a framer-motion `repeat: Infinity` loop that ran on the main
   * thread on its own 150ms clock, out of phase with the numbers it was
   * supposed to be punctuating.
   */
  const pulse = (peak: number, ms: number) => {
    const el = numRef.current;
    if (!el || reduce || typeof el.animate !== "function") return;
    el.animate(
      [{ transform: `scale(${peak})` }, { transform: "scale(1)" }],
      { duration: ms, easing: "ease-out" },
    );
  };

  const start = () => {
    if (rolling) return;
    const unique = cfg.unique;

    // A finished round starts a fresh pool rather than refusing to draw.
    const pool = exhausted ? new Set<number>() : seen;
    if (exhausted) setSeen(pool);

    let final = randomInt(lo, hi);
    if (unique) {
      if (span <= POOL_MAX) {
        const free: number[] = [];
        for (let n = lo; n <= hi; n++) {
          if (!pool.has(n)) free.push(n);
        }
        final = free[Math.floor(Math.random() * free.length)];
      } else {
        for (let i = 0; i < 64 && pool.has(final); i++) final = randomInt(lo, hi);
      }
    }

    setRolling(true);
    const t0 = performance.now();
    const dur = 1400 + Math.random() * 400;
    const tick = () => {
      const t = (performance.now() - t0) / dur;
      if (t >= 1) {
        timerRef.current = null;
        display.set(String(final));
        pulse(1.08, 260);
        setValue(final);
        setRolling(false);
        if (unique) setSeen((s) => new Set(s).add(final));
        pushHistory({ engineId: engine.slug, outcome: String(final) });
        return;
      }
      // slow down towards end
      const ease = 1 - Math.pow(1 - t, 3);
      display.set(String(randomInt(lo, hi)));
      pulse(1.05, 120);
      const delay = 40 + ease * 260;
      timerRef.current = window.setTimeout(tick, delay);
    };
    tick();
  };

  /*
   * Size the digits to the widest number the range can produce, so a long
   * range fits the panel and the size doesn't jump while rolling. The px term
   * caps it inside the two-column desktop panel; the vw term covers the
   * single-column layout, where even "100" at 160px overflowed a phone.
   */
  const chars = Math.max(String(lo).length, String(hi).length);
  const fontSize = `min(160px, ${Math.floor(780 / chars)}px, calc((100vw - 8rem) / ${(chars * 0.66).toFixed(2)}))`;

  return (
    <EngineShell
      engine={engine}
      variant="cool"
      side={
        <>
          <SidePanel title="Range">
            <div className="space-y-3">
              <NumInput
                label="Min"
                value={cfg.min}
                disabled={rolling}
                onChange={(v) => persist({ min: v })}
              />
              <NumInput
                label="Max"
                value={cfg.max}
                disabled={rolling}
                onChange={(v) => persist({ max: v })}
              />
            </div>
          </SidePanel>
          <SidePanel title="Mode">
            <label className="flex items-center justify-between text-sm text-white/80">
              <span>No repeats until exhausted</span>
              <input
                type="checkbox"
                checked={cfg.unique}
                disabled={rolling}
                onChange={(e) => {
                  persist({ unique: e.target.checked });
                  if (!e.target.checked) setSeen(new Set());
                }}
                className="h-4 w-4 accent-fuchsia-400"
              />
            </label>
            {cfg.unique && (
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-white/40">
                <p>
                  {exhausted
                    ? "All used — the next draw starts a new round"
                    : `${usedInRange} used · ${span - usedInRange} remaining`}
                </p>
                {seen.size > 0 && !rolling && (
                  <button
                    onClick={() => setSeen(new Set())}
                    className="shrink-0 rounded-lg px-2 py-1 text-white/50 hover:bg-white/5 hover:text-white/80"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-10">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          Between {lo} and {hi}
        </p>
        <div className="grid w-full flex-1 place-items-center">
          <motion.div
            ref={numRef}
            aria-hidden
            className="whitespace-nowrap font-black leading-none tracking-tighter tabular-nums text-gradient"
            style={{ fontSize, fontVariantNumeric: "tabular-nums" }}
          >
            {display}
          </motion.div>
          {/* Announce only the settled result, not every rolling digit. */}
          <span className="sr-only" aria-live="polite">
            {!rolling && value !== null ? `Result: ${value}` : ""}
          </span>
        </div>
        <BigActionButton
          label={rolling ? "Choosing…" : "Generate"}
          onClick={start}
          disabled={rolling}
          color="#10b981"
          color2="#0ea5e9"
        />
      </div>
    </EngineShell>
  );
}

/*
 * The field keeps its own text and only reports a number once what has been
 * typed parses to one. Coercing every keystroke (`parseInt(...) || 0`) made
 * negative numbers impossible to type — "-" isn't a number yet, so it snapped
 * to 0 — and clearing the field to retype it jammed a 0 in front.
 */
function NumInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(String(value));

  // Follow outside changes (config load) without fighting an in-progress
  // edit that already means the same number ("2." while typing "2.5").
  useEffect(() => {
    setText((t) => {
      const n = parseFloat(t);
      return Number.isFinite(n) && clampInt(n) === value ? t : String(value);
    });
  }, [value]);

  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-widest text-white/40">
        {label}
      </span>
      <input
        type="number"
        step={1}
        inputMode="numeric"
        value={text}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          const n = parseFloat(raw);
          if (Number.isFinite(n)) onChange(clampInt(n));
        }}
        onBlur={() => setText(String(value))}
        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/25 focus:bg-white/10 disabled:opacity-50"
      />
    </label>
  );
}
