"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type AnimationPlaybackControls,
} from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { pickWeighted, stable } from "@/lib/random";
import Confetti from "@/components/Confetti";
import { Plus, Trash2, Shuffle } from "lucide-react";

type Slice = { id: string; label: string; color: string; weight: number };
type WheelConfig = {
  slices: Slice[];
  removeAfter: boolean;
};

const PALETTE = [
  "#f472b6",
  "#a855f7",
  "#38bdf8",
  "#22d3ee",
  "#22c55e",
  "#facc15",
  "#f97316",
  "#ef4444",
  "#8b5cf6",
  "#0ea5e9",
];

const MAX_WEIGHT = 20;
/** One spin, in seconds. The winner is revealed when the animation settles. */
const SPIN_S = 4;
const SPIN_EASE = [0.16, 0.84, 0.28, 1] as const;
const CONFETTI_MS = 2400;
/** A lone wedge is the whole disc — an arc whose two ends coincide draws nothing. */
const FULL_DISC = "M -1 0 A 1 1 0 1 1 1 0 A 1 1 0 1 1 -1 0 Z";

// Stable ids: this runs at module scope on both server and client.
const seedSlices = (): Slice[] =>
  ["Pizza", "Sushi", "Burgers", "Salad", "Tacos", "Ramen"].map((label, i) => ({
    id: `seed-${i}`,
    label,
    color: PALETTE[i % PALETTE.length],
    weight: 1,
  }));

const DEFAULT: WheelConfig = { slices: seedSlices(), removeAfter: false };

/** Finite, non-negative and capped. A weight of 0 leaves the slice off the wheel. */
const weightOf = (s: Slice) =>
  Number.isFinite(s.weight) ? Math.min(MAX_WEIGHT, Math.max(0, s.weight)) : 0;
const labelOf = (s: Slice) => s.label.trim() || "Untitled";
const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Saved configs are hand-editable JSON; don't let a bad entry crash the wheel. */
function normalize(c: WheelConfig): WheelConfig {
  const slices = Array.isArray(c.slices)
    ? c.slices
        .filter(
          (s): s is Slice =>
            !!s && typeof s.id === "string" && typeof s.label === "string",
        )
        .map((s, i) => ({
          ...s,
          color: typeof s.color === "string" ? s.color : PALETTE[i % PALETTE.length],
          weight: typeof s.weight === "number" && Number.isFinite(s.weight) ? s.weight : 1,
        }))
    : DEFAULT.slices;
  return { slices, removeAfter: c.removeAfter === true };
}

export default function WheelEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<WheelConfig>(DEFAULT);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Slice | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  /*
   * With "remove winner" on, the winner leaves the config the moment the wheel
   * stops. Redrawn without it, the remaining wedges slid round under a pointer
   * that then sat on some *other* option while the text announced the removed
   * one. The wheel keeps drawing the layout it landed on until the next spin or
   * edit; the options list updates straight away.
   */
  const [landed, setLanded] = useState<Slice[] | null>(null);
  const reduce = useReducedMotion();

  /*
   * Rotation is a motion value driven by `animate()`: nothing re-renders while
   * the wheel turns, and the winner is revealed when the animation itself
   * resolves rather than by a timeout hand-synced to the transition (4200ms
   * against a 4s transition), which also kept firing after the page was left.
   */
  const rotation = useMotionValue(0);
  const spinAnim = useRef<AnimationPlaybackControls | null>(null);
  const confettiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      spinAnim.current?.stop();
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
    };
  }, []);

  useEffect(() => {
    setCfg(normalize(readConfig<WheelConfig>(engine.slug, DEFAULT)));
  }, [engine.slug]);

  const persist = (next: WheelConfig) => {
    setCfg(next);
    setLanded(null);
    writeConfig(engine.slug, next);
  };

  const slices = cfg.slices;
  const active = useMemo(() => slices.filter((s) => weightOf(s) > 0), [slices]);
  const drawn = landed ?? slices;

  /*
   * Wedge geometry is derived once per slice change instead of inside the render
   * body. The previous version re-ran a `slice(0, i).reduce(...)` per wedge —
   * quadratic work plus a fresh array per wedge — on every single render, and
   * this component re-renders on every keystroke in the options panel.
   *
   * `spin` aims with exactly this accumulation (same filter, same `weightOf`),
   * so the angle it targets is the wedge that's actually drawn.
   */
  const wedges = useMemo(() => {
    const on = drawn.filter((s) => weightOf(s) > 0);
    const total = on.reduce((t, s) => t + weightOf(s), 0);
    if (total <= 0) return [];
    let acc = 0;
    return on.map((s) => {
      const start = (acc / total) * Math.PI * 2;
      acc += weightOf(s);
      const end = (acc / total) * Math.PI * 2;
      const x1 = stable(Math.cos(start));
      const y1 = stable(Math.sin(start));
      const x2 = stable(Math.cos(end));
      const y2 = stable(Math.sin(end));
      const large = end - start > Math.PI ? 1 : 0;
      const mid = (start + end) / 2;
      const tx = stable(Math.cos(mid) * 0.62);
      const ty = stable(Math.sin(mid) * 0.62);
      const label = truncate(labelOf(s), 14);
      // Labels run along the arc at r = 0.62; shrink them to fit thin wedges
      // instead of letting neighbours overprint each other.
      const fit = (0.62 * (end - start) * 0.9) / (label.length * 0.6);
      return {
        id: s.id,
        color: s.color,
        label,
        fontSize: stable(Math.max(0.03, Math.min(0.08, fit))),
        path:
          on.length === 1
            ? FULL_DISC
            : `M 0 0 L ${x1} ${y1} A 1 1 0 ${large} 1 ${x2} ${y2} Z`,
        tx,
        ty,
        textRotate: stable((mid * 180) / Math.PI + 90),
      };
    });
  }, [drawn]);

  const spin = async () => {
    if (spinning || active.length < 2) return;
    // Zero-weight slices aren't on the wheel, so they can't be drawn either.
    const outcome = pickWeighted<Slice>(
      active.map((s) => ({ value: s, weight: weightOf(s) })),
    );
    const total = active.reduce((t, s) => t + weightOf(s), 0);
    let acc = 0;
    for (const s of active) {
      if (s.id === outcome.id) break;
      acc += weightOf(s);
    }
    const size = (weightOf(outcome) / total) * 360;
    const center = (acc / total) * 360 + size / 2;
    const jitter = (Math.random() - 0.5) * (size * 0.6);

    /*
     * Wedge angles are measured clockwise from 3 o'clock (SVG +x), and a
     * positive CSS rotation also turns clockwise, so after rotating by R a
     * point drawn at θ sits at θ + R. The pointer is at 12 o'clock (-90°), so
     * the outcome's centre is under it when R ≡ -90 - centre (mod 360).
     *
     * The old code added that offset to the *current* rotation. That's only
     * right while the current rotation is a whole number of turns — the first
     * spin. From the second spin on the previous offset was still baked in, and
     * the wheel stopped on a different wedge than the one announced. Here the
     * distance left to travel is measured from where the wheel actually is.
     *
     * e.g. six equal wedges, wheel resting at 2280° (≡ 120°), outcome wedge 0
     * (centre 30°): goal ≡ -120°; distance = mod(-120 - 120, 360) = 120°;
     * final = 120 + 7·360 + 120 ≡ 240°, and 30 + 240 = 270 ≡ -90°. Under the
     * pointer. (The old code ended at 2280 + 7·360 - 120 ≡ 0°: wedge 0's centre
     * at 3 o'clock.)
     */
    const start = mod(rotation.get(), 360);
    rotation.jump(start); // same angle on screen; keeps the value from growing forever
    const turns = reduce ? 1 : 6 + Math.floor(Math.random() * 3);
    const target = start + turns * 360 + mod(-90 - center + jitter - start, 360);

    // Starting a spin draws the current options, which is what we aimed at.
    setLanded(null);
    setWinner(null);
    setSpinning(true);
    const anim = animate(rotation, target, {
      duration: reduce ? 0.8 : SPIN_S,
      ease: SPIN_EASE,
    });
    spinAnim.current = anim;
    await anim;
    if (!alive.current) return;
    spinAnim.current = null;

    setSpinning(false);
    setWinner(outcome);
    setShowConfetti(true);
    if (confettiTimer.current) clearTimeout(confettiTimer.current);
    confettiTimer.current = setTimeout(() => setShowConfetti(false), CONFETTI_MS);
    pushHistory({ engineId: engine.slug, outcome: labelOf(outcome) });
    // `cfg` can't have changed mid-spin: the side panels are disabled while spinning.
    if (cfg.removeAfter) {
      persist({
        ...cfg,
        slices: slices.filter((s) => s.id !== outcome.id),
      });
      setLanded(slices);
    }
  };

  const addSlice = () => {
    const label = `Option ${slices.length + 1}`;
    persist({
      ...cfg,
      slices: [
        ...slices,
        {
          id: Math.random().toString(36).slice(2, 9),
          label,
          color: PALETTE[slices.length % PALETTE.length],
          weight: 1,
        },
      ],
    });
  };

  const updateSlice = (id: string, patch: Partial<Slice>) => {
    persist({
      ...cfg,
      slices: slices.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  const removeSlice = (id: string) => {
    persist({ ...cfg, slices: slices.filter((s) => s.id !== id) });
  };

  const shuffleColors = () => {
    persist({
      ...cfg,
      slices: slices.map((s, i) => ({
        ...s,
        color: PALETTE[(i * 3 + Math.floor(Math.random() * PALETTE.length)) % PALETTE.length],
      })),
    });
  };

  return (
    <EngineShell
      engine={engine}
      variant="cool"
      side={
        <>
          <SidePanel title="Options">
            {/* Disabled mid-spin: an edit would re-lay the wheel under the pointer. */}
            <fieldset
              disabled={spinning}
              className="min-w-0 transition-opacity disabled:opacity-60"
            >
              <div className="max-h-96 overflow-y-auto pr-1">
                <ul className="space-y-2">
                  {slices.map((s) => (
                    <li
                      key={s.id}
                      className="group flex items-center gap-2 rounded-xl bg-white/5 p-2 ring-1 ring-white/10"
                    >
                      <input
                        type="color"
                        value={s.color}
                        onChange={(e) =>
                          updateSlice(s.id, { color: e.target.value })
                        }
                        aria-label="Colour"
                        className="h-8 w-8 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                      />
                      <input
                        value={s.label}
                        onChange={(e) =>
                          updateSlice(s.id, { label: e.target.value.slice(0, 32) })
                        }
                        placeholder="Untitled"
                        aria-label="Option label"
                        className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-1 text-sm text-white outline-none"
                      />
                      <input
                        type="number"
                        min={0}
                        max={MAX_WEIGHT}
                        step={0.1}
                        value={s.weight}
                        onChange={(e) =>
                          updateSlice(s.id, {
                            weight: Math.min(
                              MAX_WEIGHT,
                              Math.max(0, parseFloat(e.target.value) || 0),
                            ),
                          })
                        }
                        className={
                          "w-14 shrink-0 rounded-lg bg-white/5 px-2 py-1 text-right text-xs outline-none " +
                          (weightOf(s) > 0 ? "text-white/80" : "text-white/35")
                        }
                        aria-label="Weight"
                        title="Weight — 0 leaves it off the wheel"
                      />
                      <button
                        onClick={() => removeSlice(s.id)}
                        aria-label={`Remove ${labelOf(s)}`}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/40 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-300 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={addSlice}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-white/5 px-3 py-2 text-xs font-medium text-white ring-1 ring-white/10 hover:bg-white/10"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
                <button
                  onClick={shuffleColors}
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-white/5 px-3 py-2 text-xs font-medium text-white ring-1 ring-white/10 hover:bg-white/10"
                >
                  <Shuffle className="h-3.5 w-3.5" /> Colors
                </button>
              </div>
            </fieldset>
          </SidePanel>
          <SidePanel title="Modes">
            <fieldset
              disabled={spinning}
              className="min-w-0 transition-opacity disabled:opacity-60"
            >
              <label className="flex items-center justify-between text-sm text-white/80">
                <span>Remove winner after spin</span>
                <input
                  type="checkbox"
                  checked={cfg.removeAfter}
                  onChange={(e) =>
                    persist({ ...cfg, removeAfter: e.target.checked })
                  }
                  className="h-4 w-4 accent-fuchsia-400"
                />
              </label>
            </fieldset>
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-white/40">
            {active.length < 2 ? "Add at least two options" : "Spin to decide"}
          </p>
        </div>
        {/* Sized to the panel on narrow screens instead of a fixed 360px. */}
        <div className="relative aspect-square w-full max-w-[360px]">
          {/* Pointer */}
          <div
            className="absolute -top-2 left-1/2 z-20 -translate-x-1/2"
            aria-hidden
          >
            <div
              className="h-6 w-6"
              style={{
                background: "linear-gradient(180deg, #fff, #cbd5e1)",
                clipPath: "polygon(50% 100%, 0 0, 100% 0)",
                boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
              }}
            />
          </div>
          {/* Ring */}
          <div
            className="absolute -inset-2 rounded-full opacity-70 blur-lg"
            style={{
              background:
                "conic-gradient(from 90deg, rgba(139,92,246,0.6), rgba(56,189,248,0.6), rgba(244,114,182,0.6), rgba(139,92,246,0.6))",
            }}
          />
          {/*
            The wheel's shadow lives on this static circle rather than as a
            `drop-shadow()` filter on the spinning SVG. A filter on an animating
            element has to be re-evaluated from scratch every frame — for four
            seconds of spin that meant re-rasterizing a 360px blurred silhouette
            60 times a second. The wheel is a circle, so an identical look comes
            from a plain box-shadow on a layer that never moves.
          */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              boxShadow:
                "0 20px 40px rgba(0,0,0,0.4), 0 0 40px rgba(139,92,246,0.35)",
            }}
          />
          {/*
            `will-change` stays on permanently. Toggled with `spinning`, the
            wheel's compositor layer was created in the very frame the spin
            started, so every spin opened by rasterizing the whole SVG into a
            fresh layer — a hitch right as the wheel should whip away — and
            dropped it again on landing.
          */}
          <motion.svg
            viewBox="-1 -1 2 2"
            className="absolute inset-0 h-full w-full"
            style={{ rotate: rotation, willChange: "transform" }}
          >
            {wedges.length === 0 ? (
              <text
                x="0"
                y="0"
                textAnchor="middle"
                fontSize="0.1"
                fill="white"
              >
                Add options
              </text>
            ) : (
              wedges.map((s) => (
                <g key={s.id}>
                  <path
                    d={s.path}
                    fill={s.color}
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth="0.006"
                  />
                  <text
                    x={s.tx}
                    y={s.ty}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={s.fontSize}
                    fontWeight={700}
                    fill="white"
                    transform={`rotate(${s.textRotate}, ${s.tx}, ${s.ty})`}
                    style={{
                      paintOrder: "stroke",
                      stroke: "rgba(0,0,0,0.3)",
                      strokeWidth: 0.004,
                    }}
                  >
                    {s.label}
                  </text>
                </g>
              ))
            )}
            {/* Hub */}
            <circle
              r="0.1"
              fill="url(#hub)"
              stroke="white"
              strokeWidth="0.01"
            />
            <defs>
              <radialGradient id="hub">
                <stop offset="0%" stopColor="#fff" />
                <stop offset="100%" stopColor="#cbd5e1" />
              </radialGradient>
            </defs>
          </motion.svg>
        </div>

        <div className="flex max-w-full flex-col items-center gap-6">
          <AnimatePresence mode="wait">
            {winner && !spinning && (
              <motion.div
                key={winner.id}
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 250 }}
                className="max-w-full text-center"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-white/50">
                  Winner
                </p>
                <p
                  className="mt-1 text-3xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-4xl"
                  style={{ color: winner.color }}
                >
                  {labelOf(winner)}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <BigActionButton
            label={spinning ? "Spinning…" : "Spin the wheel"}
            onClick={spin}
            disabled={spinning || active.length < 2}
            color="#38bdf8"
            color2="#a855f7"
          />
        </div>
      </div>

      {showConfetti && <Confetti />}
    </EngineShell>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
