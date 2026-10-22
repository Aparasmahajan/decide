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
import { stable } from "@/lib/random";

type DirConfig = { customLabels: string; count: number };
const DEFAULT: DirConfig = { customLabels: "N,E,S,W", count: 4 };

const FALLBACK_LABELS = ["N", "E", "S", "W"];
/** Past this the dial is unreadable — neighbours print over each other. */
const MAX_LABELS = 24;
/** One spin, in seconds. The result is revealed when the animation settles. */
const SPIN_S = 3.6;
const SPIN_EASE = [0.16, 0.84, 0.28, 1] as const;

/*
 * Dial geometry as % of the dial (designed at 380px). The dial shrinks to fit
 * narrow screens — at a fixed 380px it overflowed phones — so the label ring
 * and needle are proportional.
 */
const LABEL_R = (160 / 380) * 100;
const NEEDLE_W = (30 / 380) * 100;
const NEEDLE_H = (240 / 380) * 100;

const mod = (a: number, n: number) => ((a % n) + n) % n;

export default function DirectionEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<DirConfig>(DEFAULT);
  const [spinning, setSpinning] = useState(false);
  // The index too: labels may repeat, and the dial highlights the exact one hit.
  const [chosen, setChosen] = useState<{ idx: number; label: string } | null>(
    null,
  );
  const reduce = useReducedMotion();

  /*
   * The needle turns via a motion value and `animate()`: no re-render per
   * frame, and the result is revealed when the animation resolves instead of
   * by a timeout hand-synced to the transition — one that also kept firing
   * after the page was left.
   */
  const rot = useMotionValue(0);
  const spinAnim = useRef<AnimationPlaybackControls | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      spinAnim.current?.stop();
    };
  }, []);

  useEffect(() => {
    const c = readConfig<DirConfig>(engine.slug, DEFAULT);
    setCfg({
      ...c,
      // Hand-edited storage; the input below needs a string.
      customLabels:
        typeof c.customLabels === "string" ? c.customLabels : DEFAULT.customLabels,
    });
  }, [engine.slug]);

  const persist = (patch: Partial<DirConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  /*
   * `.filter(Boolean) || [...]` never fell back — an empty array is truthy —
   * so clearing the field left zero labels, a NaN rotation and an `undefined`
   * outcome written to history.
   */
  const parsed = useMemo(
    () =>
      cfg.customLabels
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [cfg.customLabels],
  );
  const labels = parsed.length ? parsed.slice(0, MAX_LABELS) : FALLBACK_LABELS;
  const truncated = parsed.length > MAX_LABELS;

  const spin = async () => {
    if (spinning) return;
    const n = labels.length;
    const slot = 360 / n;
    const idx = Math.floor(Math.random() * n);
    const label = labels[idx];

    /*
     * Label i sits i·slot clockwise from 12 o'clock, and the needle's tip
     * points to 12 o'clock at rotation 0, so rotation R aims it at R. Label i
     * is hit when R ≡ i·slot (mod 360).
     *
     * The old code set R = turns·360 + i·slot measured from *zero* on every
     * spin, so a needle resting at 7 turns could be sent to 5 — spinning
     * backwards. The distance is now measured from where the needle is.
     * e.g. N,E,S,W, resting at 1980° (≡ 180°, S), pick E (90°): distance =
     * mod(90 - 180, 360) = 270, final = 180 + turns·360 + 270 ≡ 90°: E.
     */
    const start = mod(rot.get(), 360);
    rot.jump(start); // same angle on screen; keeps the value from growing forever
    const turns = reduce ? 1 : 5 + Math.floor(Math.random() * 3);
    const target = start + turns * 360 + mod(idx * slot - start, 360);

    setSpinning(true);
    setChosen(null);
    const anim = animate(rot, target, {
      duration: reduce ? 0.8 : SPIN_S,
      ease: SPIN_EASE,
    });
    spinAnim.current = anim;
    await anim;
    if (!alive.current) return;
    spinAnim.current = null;

    setSpinning(false);
    setChosen({ idx, label });
    pushHistory({ engineId: engine.slug, outcome: label });
  };

  const labelSize =
    labels.length > 12 ? "text-xs" : labels.length > 8 ? "text-sm" : "text-lg";

  return (
    <EngineShell
      engine={engine}
      variant="cool"
      side={
        <SidePanel title="Directions">
          {/* Disabled mid-spin: an edit re-lays the dial under an aimed needle. */}
          <fieldset
            disabled={spinning}
            className="min-w-0 transition-opacity disabled:opacity-60"
          >
            <input
              value={cfg.customLabels}
              onChange={(e) => {
                // The dial is re-laid out, so the old result no longer lines up.
                setChosen(null);
                persist({ customLabels: e.target.value });
              }}
              aria-label="Directions, comma-separated"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
              placeholder="N,E,S,W"
            />
            <p className="mt-2 text-[11px] text-white/40">
              {truncated
                ? `Only the first ${MAX_LABELS} fit on the dial.`
                : `Comma-separated, up to ${MAX_LABELS}. Empty uses N, E, S, W.`}
            </p>
          </fieldset>
        </SidePanel>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          Compass
        </p>
        <div className="relative aspect-square w-full max-w-[380px]">
          <div
            className="absolute -inset-[2.6%] rounded-full opacity-50 blur-2xl"
            style={{
              background:
                "conic-gradient(from 0deg, rgba(56,189,248,0.5), rgba(139,92,246,0.5), rgba(244,114,182,0.5), rgba(56,189,248,0.5))",
            }}
          />
          <div className="absolute inset-0 rounded-full border border-white/10 bg-white/[0.03]">
            {labels.map((l, i) => {
              const angle = ((i / labels.length) * 360 - 90) * (Math.PI / 180);
              const hit = chosen?.idx === i && !spinning;
              return (
                <div
                  key={i}
                  className={
                    "absolute max-w-[30%] -translate-x-1/2 -translate-y-1/2 truncate font-semibold transition-colors " +
                    labelSize +
                    (hit ? " text-white" : " text-white/60")
                  }
                  style={{
                    left: `${stable(50 + Math.cos(angle) * LABEL_R)}%`,
                    top: `${stable(50 + Math.sin(angle) * LABEL_R)}%`,
                  }}
                  title={l}
                >
                  {l}
                </div>
              );
            })}
            {/*
              Needle. Centred by a static wrapper, so the rotation is the only
              transform framer-motion owns, and the rotating element is just the
              needle rather than the whole 380px dial.

              The glow is a `drop-shadow()` filter, so the rotating layer is
              promoted permanently: the filter is rasterized into it once and the
              compositor only turns the bitmap. Unpromoted, every frame of the
              spin repainted the needle and re-ran the 20px blur.
            */}
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ width: `${NEEDLE_W}%`, height: `${NEEDLE_H}%` }}
            >
              <motion.div
                className="h-full w-full"
                style={{ rotate: rot, willChange: "transform" }}
              >
                <svg
                  viewBox="0 0 30 240"
                  className="block h-full w-full drop-shadow-[0_0_20px_rgba(244,114,182,0.6)]"
                >
                  <defs>
                    <linearGradient id="dneedle" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#f472b6" />
                      <stop offset="50%" stopColor="#fff" />
                      <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>
                  </defs>
                  <polygon points="15,10 22,120 15,130 8,120" fill="#f472b6" />
                  <polygon
                    points="15,230 22,120 15,110 8,120"
                    fill="#38bdf8"
                  />
                  <circle cx="15" cy="120" r="7" fill="url(#dneedle)" />
                  <circle cx="15" cy="120" r="3" fill="#fff" />
                </svg>
              </motion.div>
            </div>
          </div>
        </div>
        <div className="flex max-w-full flex-col items-center gap-6">
          <AnimatePresence mode="wait">
            {chosen && !spinning && (
              <motion.div
                key={`${chosen.idx}-${chosen.label}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="max-w-full text-center"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-white/50">
                  Points to
                </p>
                <p className="mt-1 text-4xl font-semibold text-white [overflow-wrap:anywhere] sm:text-5xl">
                  {chosen.label}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <BigActionButton
            label={spinning ? "Spinning…" : "Spin needle"}
            onClick={spin}
            disabled={spinning}
            color="#22d3ee"
            color2="#3b82f6"
          />
        </div>
      </div>
    </EngineShell>
  );
}
