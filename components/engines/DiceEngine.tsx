"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { randomInt } from "@/lib/random";
import { Minus, Plus } from "lucide-react";

type Sides = 4 | 6 | 8 | 10 | 12 | 20;

type DiceConfig = {
  count: number;
  sides: Sides;
  color: string;
};

const DEFAULT: DiceConfig = { count: 2, sides: 6, color: "#f472b6" };

const SIDES: Sides[] = [4, 6, 8, 10, 12, 20];
const MIN_DICE = 1;
const MAX_DICE = 12;
const COLORS = [
  "#f472b6",
  "#a855f7",
  "#38bdf8",
  "#22c55e",
  "#facc15",
  "#f97316",
  "#ef4444",
  "#e2e8f0",
];

/** One roll, first tumble to landing. The tumble and the reveal both use it. */
const ROLL_MS = 1400;
/** Each die leaves the hand a little after the previous one… */
const STAGGER_MS = 40;
/** …but all of them land together, at ROLL_MS. */
const MAX_STAGGER_MS = ROLL_MS / 3;
/** How often the faces change while the dice are in the air. */
const FLICKER_MS = 80;

/** Stored configs can be stale or hand-edited; never let one produce NaN dice. */
function sanitize(c: DiceConfig): DiceConfig {
  return {
    count: Number.isFinite(c.count)
      ? Math.min(MAX_DICE, Math.max(MIN_DICE, Math.round(c.count)))
      : DEFAULT.count,
    sides: SIDES.includes(c.sides) ? c.sides : DEFAULT.sides,
    color: typeof c.color === "string" && c.color ? c.color : DEFAULT.color,
  };
}

export default function DiceEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<DiceConfig>(DEFAULT);
  /** Faces of the last roll, or null when the dice on the table are unrolled. */
  const [result, setResult] = useState<number[] | null>(null);
  const [rolling, setRolling] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCfg(sanitize(readConfig<DiceConfig>(engine.slug, DEFAULT)));
  }, [engine.slug]);

  // Leaving the page mid-roll must not land the roll, or write history, later.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const persist = (patch: Partial<DiceConfig>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    writeConfig(engine.slug, next);
    /*
     * A result only describes the dice it was rolled with. It used to survive a
     * change of die: a d20's 17 was then drawn as a d6 — which has no pip
     * layout for 17, so the die went blank — under a total for dice that were
     * no longer on the table.
     */
    if (next.count !== cfg.count || next.sides !== cfg.sides) setResult(null);
  };

  const placeholder = useMemo(
    () => Array.from({ length: cfg.count }, () => 1),
    [cfg.count],
  );
  const values = result ?? placeholder;
  const total = result ? result.reduce((a, b) => a + b, 0) : 0;

  const roll = () => {
    if (rolling) return;
    // Count and sides are locked while rolling (their buttons are disabled), so
    // the tray, the total and the history line all describe this one roll.
    const { count, sides } = cfg;
    const finals = Array.from({ length: count }, () => randomInt(1, sides));
    setResult(null);
    setRolling(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setResult(finals);
      setRolling(false);
      const sum = finals.reduce((a, b) => a + b, 0);
      pushHistory({
        engineId: engine.slug,
        outcome:
          count === 1
            ? `${sum} (1d${sides})`
            : `${finals.join(" + ")} = ${sum} (${count}d${sides})`,
      });
    }, ROLL_MS);
  };

  return (
    <EngineShell
      engine={engine}
      variant="cool"
      side={
        <>
          <SidePanel title="Dice type">
            <div className="grid grid-cols-3 gap-2">
              {SIDES.map((s) => (
                <button
                  key={s}
                  onClick={() => persist({ sides: s })}
                  disabled={rolling}
                  aria-pressed={cfg.sides === s}
                  className={
                    "rounded-xl px-3 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed " +
                    (cfg.sides === s
                      ? "bg-white text-ink-950 shadow-glow"
                      : "bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white disabled:opacity-50")
                  }
                >
                  d{s}
                </button>
              ))}
            </div>
          </SidePanel>

          <SidePanel title="Count">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => persist({ count: Math.max(MIN_DICE, cfg.count - 1) })}
                disabled={rolling || cfg.count <= MIN_DICE}
                aria-label="One die fewer"
                className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="flex-1 rounded-xl bg-white/5 py-2 text-center text-xl font-semibold tabular-nums text-white ring-1 ring-white/10">
                {cfg.count}
              </div>
              <button
                onClick={() => persist({ count: Math.min(MAX_DICE, cfg.count + 1) })}
                disabled={rolling || cfg.count >= MAX_DICE}
                aria-label="One die more"
                className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </SidePanel>

          <SidePanel title="Color">
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => persist({ color: c })}
                  aria-label={`Dice color ${c}`}
                  aria-pressed={cfg.color === c}
                  className={
                    "h-8 w-8 rounded-full transition-transform hover:scale-110 " +
                    (cfg.color === c ? "ring-2 ring-white" : "ring-1 ring-white/10")
                  }
                  style={{ background: c }}
                />
              ))}
            </div>
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-10">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-white/40">
            Rolling
          </p>
          <p className="mt-1 text-lg font-medium text-white/80">
            {cfg.count} × d{cfg.sides}
          </p>
        </div>

        {/*
          No `key={tick}` remount here any more. Re-keying the tray at the start
          of every roll tore down and rebuilt every die — and its compositor
          layer — on the very frame the tumble was meant to begin.
        */}
        <div className="grid flex-1 place-items-center">
          <DiceTray
            values={values}
            sides={cfg.sides}
            color={cfg.color}
            rolling={rolling}
          />
        </div>

        <div className="flex flex-col items-center gap-6">
          <AnimatePresence mode="wait">
            {result && !rolling && (
              <motion.div
                key={result.join(",")}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-white/50">
                  Total
                </p>
                <p className="mt-1 text-5xl font-semibold tracking-tight text-white tabular-nums">
                  {total}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <BigActionButton
            label={rolling ? "Rolling…" : "Roll dice"}
            onClick={roll}
            disabled={rolling}
            color="#a855f7"
            color2="#ec4899"
          />
        </div>
      </div>
    </EngineShell>
  );
}

/*
 * The tumbling faces live in their own component. Driven from the engine, every
 * flicker re-rendered the whole page — shell, aurora, nav, side panels — a dozen
 * times a second for the length of the roll. Here a flicker re-renders the dice
 * and nothing else.
 */
function DiceTray({
  values,
  sides,
  color,
  rolling,
}: {
  values: number[];
  sides: Sides;
  color: string;
  rolling: boolean;
}) {
  const reduce = useReducedMotion();
  const [faces, setFaces] = useState<number[]>(values);
  const n = values.length;

  useEffect(() => {
    if (!rolling) return;
    const scramble = () =>
      setFaces(Array.from({ length: n }, () => randomInt(1, sides)));
    scramble();
    const id = setInterval(scramble, FLICKER_MS);
    return () => clearInterval(id);
  }, [rolling, sides, n]);

  // On the first rolling frame `faces` may still be sized for the previous
  // count; fall back to the real dice rather than flash the wrong number.
  const shown = rolling && faces.length === n ? faces : values;

  /*
   * Wrapping flex row, capped at six dice across. The previous fixed
   * `repeat(min(count, 6))` grid needed 632px for six dice and overflowed the
   * panel on phones and on the narrow two-column desktop layout.
   */
  return (
    <div className="flex max-w-[632px] flex-wrap justify-center gap-3 sm:gap-4">
      {shown.map((v, i) => (
        <DieVisual
          key={i}
          value={v}
          sides={sides}
          color={color}
          tumbling={rolling && !reduce}
          delayMs={Math.min(i * STAGGER_MS, MAX_STAGGER_MS)}
        />
      ))}
    </div>
  );
}

function DieVisual({
  value,
  sides,
  color,
  tumbling,
  delayMs,
}: {
  value: number;
  sides: Sides;
  color: string;
  tumbling: boolean;
  delayMs: number;
}) {
  const isCube = sides === 6;
  return (
    /*
     * One bounded tumble per roll that ends upright at ROLL_MS, the same moment
     * the result is revealed. It used to loop a 1.2s cycle for a random
     * 1.2–1.8s roll, so the total appeared while every die was still mid-spin
     * and then unwound — up to two full turns backwards — back to 0°.
     *
     * `will-change` is permanent so the die (and its soft shadow) is rasterized
     * once and only moved, instead of repainted every frame of the tumble.
     */
    <motion.div
      animate={
        tumbling
          ? {
              rotate: [0, 360, -180, 720, 0],
              y: [0, -20, 0, -10, 0],
            }
          : { rotate: 0, y: 0 }
      }
      transition={
        tumbling
          ? {
              duration: (ROLL_MS - delayMs) / 1000,
              delay: delayMs / 1000,
              ease: "easeInOut",
            }
          : { duration: 0.2 }
      }
      className="grid place-items-center"
      style={{ willChange: "transform" }}
    >
      <div
        className="grid h-[72px] w-[72px] place-items-center rounded-2xl sm:h-[92px] sm:w-[92px]"
        style={{
          background: `linear-gradient(135deg, ${color}dd, ${color}77)`,
          boxShadow: `0 20px 40px -12px ${color}66, inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -6px 12px rgba(0,0,0,0.2)`,
        }}
      >
        {isCube ? (
          <PipFace value={value} />
        ) : (
          <div className="text-2xl font-bold tabular-nums text-white drop-shadow-md sm:text-3xl">
            {value}
          </div>
        )}
      </div>
    </motion.div>
  );
}

const PIP_LAYOUT: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
  ],
  5: [
    [0, 0],
    [0, 2],
    [1, 1],
    [2, 0],
    [2, 2],
  ],
  6: [
    [0, 0],
    [0, 2],
    [1, 0],
    [1, 2],
    [2, 0],
    [2, 2],
  ],
};

function PipFace({ value }: { value: number }) {
  const pips = PIP_LAYOUT[value] ?? [];
  return (
    <div
      className="grid h-12 w-12 gap-[3px] sm:h-16 sm:w-16 sm:gap-1"
      style={{
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "repeat(3, 1fr)",
      }}
    >
      {Array.from({ length: 9 }).map((_, i) => {
        const r = Math.floor(i / 3);
        const c = i % 3;
        const on = pips.some(([pr, pc]) => pr === r && pc === c);
        /*
         * No `transition-all`: the faces change every FLICKER_MS while rolling,
         * so each pip was permanently mid-way through a `box-shadow` transition
         * — up to 108 shadow repaints per frame with twelve dice out.
         */
        return (
          <div
            key={i}
            className="rounded-full"
            style={{
              background: on ? "white" : "transparent",
              boxShadow: on ? "0 2px 6px rgba(0,0,0,0.35)" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
