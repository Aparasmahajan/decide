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

type PersonConfig = {
  count: number;
  names: string[];
};

const DEFAULT: PersonConfig = { count: 8, names: [] };

const MIN_COUNT = 2;
const MAX_COUNT = 100;
/** One spin, in seconds. The pick is revealed when the animation settles. */
const SPIN_S = 3.8;
const SPIN_EASE = [0.16, 0.84, 0.28, 1] as const;
/**
 * The circle is laid out for a 520px stage, then scaled to whatever width the
 * panel actually has — a fixed 520px overflowed phones and even the main
 * column of a 1024px-wide desktop. Every px value below is divided by this.
 */
const STAGE = 520;

const mod = (a: number, n: number) => ((a % n) + n) % n;
const clampCount = (n: number) =>
  Number.isFinite(n)
    ? Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.round(n)))
    : DEFAULT.count;
const parseLines = (text: string) =>
  text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
/** px on the 520px design → % of the stage. */
const pct = (px: number) => `${stable((px / STAGE) * 100)}%`;

function normalize(c: PersonConfig): PersonConfig {
  const names = Array.isArray(c.names)
    ? c.names.filter((n): n is string => typeof n === "string" && n.trim() !== "")
    : [];
  return {
    count: Math.max(clampCount(c.count), Math.min(MAX_COUNT, names.length)),
    names,
  };
}

export default function PersonEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<PersonConfig>(DEFAULT);
  /*
   * The textarea edits raw text; the config stores the parsed list. Deriving
   * the textarea from the parsed list (as before) stripped each newline and
   * trailing space the instant it was typed, so a second name could never be
   * started and "Mary Jane" came out as "MaryJane".
   */
  const [namesText, setNamesText] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);
  const reduce = useReducedMotion();

  /*
   * The pointer turns via a motion value and `animate()`: no re-render per
   * frame (with up to 100 dots on the circle, that matters), and the pick is
   * revealed when the animation resolves instead of by a timeout hand-synced
   * to the transition — one that also kept firing after the page was left.
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
    const c = normalize(readConfig<PersonConfig>(engine.slug, DEFAULT));
    setCfg(c);
    setNamesText(c.names.join("\n"));
  }, [engine.slug]);

  const persist = (patch: Partial<PersonConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  // Every name gets a spot, so the count can't drop below the name count.
  const minCount = Math.max(MIN_COUNT, Math.min(MAX_COUNT, cfg.names.length));

  const setCount = (n: number) => {
    const count = Math.max(minCount, clampCount(n));
    if (count === cfg.count) return;
    // The circle is about to be re-laid out; the old pick no longer points at anyone.
    setChosen(null);
    persist({ count });
  };

  const setNames = (text: string) => {
    setNamesText(text);
    const names = parseLines(text);
    // Names past the count used to be silently unpickable; add spots instead.
    const count = Math.max(cfg.count, Math.min(MAX_COUNT, names.length));
    if (count !== cfg.count) setChosen(null);
    persist({ names, count });
  };

  const nameOf = (i: number) => cfg.names[i] || `Person ${i + 1}`;

  const radius = useMemo(() => {
    const c = cfg.count;
    if (c <= 6) return 155;
    if (c <= 12) return 180;
    if (c <= 24) return 200;
    if (c <= 50) return 220;
    return 240;
  }, [cfg.count]);

  const dotSize = useMemo(() => {
    const c = cfg.count;
    if (c <= 8) return 44;
    if (c <= 16) return 32;
    if (c <= 32) return 22;
    if (c <= 60) return 16;
    return 12;
  }, [cfg.count]);

  const positions = useMemo(() => {
    return Array.from({ length: cfg.count }, (_, i) => {
      const angle = (i / cfg.count) * 2 * Math.PI - Math.PI / 2;
      return {
        left: pct(STAGE / 2 + Math.cos(angle) * radius),
        top: pct(STAGE / 2 + Math.sin(angle) * radius),
      };
    });
  }, [cfg.count, radius]);

  const spin = async () => {
    if (spinning) return;
    const n = cfg.count;
    const slot = 360 / n;
    const idx = Math.floor(Math.random() * n);
    const label = nameOf(idx);
    const jitter = (Math.random() - 0.5) * slot * 0.5;

    /*
     * Spot i sits at i·slot - 90° (clockwise from 3 o'clock; spot 0 at the
     * top), and the pointer's tip points along +x at rotation 0, so rotation R
     * aims it at R. Spot i is hit when R ≡ i·slot - 90 (mod 360).
     *
     * The old code set R = turns·360 + that angle measured from *zero* on every
     * spin, so a spin resting at 8 turns could be sent to 5 — whipping
     * backwards, or barely moving. The distance is now measured from where the
     * pointer is. e.g. 8 spots, resting at 1900° (≡ 100°), spot 5 (135°):
     * distance = mod(135 - 100, 360) = 35, final = 100 + turns·360 + 35 ≡ 135°.
     */
    const start = mod(rot.get(), 360);
    rot.jump(start); // same angle on screen; keeps the value from growing forever
    const turns = reduce ? 1 : 5 + Math.floor(Math.random() * 4);
    const target = start + turns * 360 + mod(idx * slot - 90 + jitter - start, 360);

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
    setChosen(idx);
    pushHistory({ engineId: engine.slug, outcome: label });
  };

  return (
    <EngineShell
      engine={engine}
      variant="default"
      side={
        <>
          {/*
            Disabled mid-spin: a new count re-lays the circle under a pointer
            that's already aimed, and a rename would no longer match the name
            being recorded.
          */}
          <SidePanel title="How many people?">
            <fieldset
              disabled={spinning}
              className="min-w-0 transition-opacity disabled:opacity-60"
            >
              <input
                type="range"
                min={MIN_COUNT}
                max={MAX_COUNT}
                value={cfg.count}
                onChange={(e) => setCount(parseInt(e.target.value, 10))}
                aria-label="Number of people"
                className="w-full accent-violet-400"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-white/60">
                <span>{MIN_COUNT}</span>
                <span className="text-lg font-semibold text-white">
                  {cfg.count}
                </span>
                <span>{MAX_COUNT}</span>
              </div>
            </fieldset>
          </SidePanel>
          <SidePanel title="Names (optional)">
            <fieldset
              disabled={spinning}
              className="min-w-0 transition-opacity disabled:opacity-60"
            >
              <textarea
                value={namesText}
                onChange={(e) => setNames(e.target.value)}
                rows={6}
                placeholder="One name per line"
                className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-white/25"
              />
              <p className="mt-2 text-[11px] text-white/40">
                {cfg.names.length > MAX_COUNT
                  ? `Only the first ${MAX_COUNT} names fit on the circle.`
                  : "Each name gets a spot; unnamed spots show as “Person N”."}
              </p>
            </fieldset>
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          {cfg.count} people around the circle
        </p>

        <div className="relative aspect-square w-full max-w-[520px]">
          <div
            className="pointer-events-none absolute inset-0 rounded-full opacity-40 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(139,92,246,0.55), transparent 70%)",
            }}
          />
          {/* `container-type` makes the `cqw` font sizes below track this circle. */}
          <div className="absolute inset-0 rounded-full border border-white/10 bg-white/[0.02] [container-type:inline-size]">
            {positions.map((p, i) => {
              const isChosen = chosen === i;
              const label = cfg.names[i] || `${i + 1}`;
              /*
                Position lives on a plain wrapper; the motion.div only scales.
                They used to share one element, and framer-motion writes its own
                `transform` (built from scale) over a `transform` string in
                `style` — so the centring and the polar offset were both
                dropped, and every dot rendered stacked near the middle.
              */
              return (
                <div
                  key={i}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: p.left, top: p.top, width: pct(dotSize) }}
                >
                  <motion.div
                    className={
                      "grid aspect-square w-full place-items-center rounded-full text-[10px] font-semibold text-white ring-1 transition-shadow " +
                      (isChosen
                        ? "ring-yellow-300 shadow-[0_0_30px_rgba(250,204,21,0.7)]"
                        : "ring-white/15")
                    }
                    style={{
                      background: `linear-gradient(135deg, hsl(${
                        (i * 37) % 360
                      }, 80%, 60%), hsl(${(i * 37 + 40) % 360}, 80%, 45%))`,
                      fontSize: `max(8px, ${(dotSize / 3 / STAGE) * 100}cqw)`,
                    }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{
                      scale: isChosen ? 1.3 : 1,
                      opacity: 1,
                    }}
                    transition={{
                      // The stagger is for the entrance; a picked dot (up to
                      // #100) shouldn't wait 0.8s to pop.
                      delay: isChosen ? 0 : i * 0.008,
                      type: "spring",
                      stiffness: 220,
                      damping: 18,
                    }}
                    title={nameOf(i)}
                  >
                    {dotSize >= 20
                      ? Array.from(label).slice(0, 2).join("").toUpperCase()
                      : ""}
                  </motion.div>
                </div>
              );
            })}
            {/*
              Pointer. Same story as the dots: the static wrapper centres it, the
              motion.div only rotates. With both on one element the
              `translate(-50%, -50%)` was dropped, the pivot sat off-centre, and
              the tip swung round a point that wasn't the circle's centre — so it
              didn't end up pointing at the person it announced.
            */}
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ width: pct(radius + 20) }}
            >
              <motion.div
                className="relative flex h-4 w-full items-center"
                style={{ rotate: rot, willChange: "transform" }}
              >
                <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-yellow-300 to-fuchsia-500 shadow-[0_0_20px_rgba(244,114,182,0.6)]" />
                <div className="absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-yellow-300 shadow-[0_0_20px_rgba(250,204,21,0.9)]" />
                <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
              </motion.div>
            </div>
          </div>
        </div>

        <div className="flex max-w-full flex-col items-center gap-6">
          <AnimatePresence mode="wait">
            {chosen !== null && !spinning && (
              <motion.div
                key={chosen}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="max-w-full text-center"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-white/50">
                  Chosen
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-white [overflow-wrap:anywhere] sm:text-4xl">
                  {nameOf(chosen)}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <BigActionButton
            label={spinning ? "Choosing…" : "Choose a person"}
            onClick={spin}
            disabled={spinning}
            color="#8b5cf6"
            color2="#ec4899"
          />
        </div>
      </div>
    </EngineShell>
  );
}
