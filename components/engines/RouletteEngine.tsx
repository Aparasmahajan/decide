"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
} from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import Confetti from "@/components/Confetti";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { randomInt, stable } from "@/lib/random";

/* ------------------------------------------------------------------ *
 * Table
 * ------------------------------------------------------------------ */

/** European single-zero wheel, clockwise from the zero. */
const WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
const STEP = 360 / WHEEL.length;
const RED = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

type Color = "red" | "black" | "green";
const colorOf = (n: number): Color =>
  n === 0 ? "green" : RED.has(n) ? "red" : "black";

const FILL: Record<Color, string> = {
  red: "#c81e3a",
  black: "#15151f",
  green: "#0f9d58",
};

type BetKey =
  | "none"
  | "red"
  | "black"
  | "even"
  | "odd"
  | "low"
  | "high"
  | "dozen1"
  | "dozen2"
  | "dozen3"
  | "number";

const BETS: { key: BetKey; label: string; pays: string }[] = [
  { key: "none", label: "Just spin", pays: "" },
  { key: "red", label: "Red", pays: "1:1" },
  { key: "black", label: "Black", pays: "1:1" },
  { key: "even", label: "Even", pays: "1:1" },
  { key: "odd", label: "Odd", pays: "1:1" },
  { key: "low", label: "1–18", pays: "1:1" },
  { key: "high", label: "19–36", pays: "1:1" },
  { key: "dozen1", label: "1st 12", pays: "2:1" },
  { key: "dozen2", label: "2nd 12", pays: "2:1" },
  { key: "dozen3", label: "3rd 12", pays: "2:1" },
  { key: "number", label: "Number", pays: "35:1" },
];

/** Zero loses every outside bet — that's the house edge. */
function wins(bet: BetKey, pick: number, n: number): boolean {
  if (bet === "number") return n === pick;
  if (n === 0) return false;
  switch (bet) {
    case "red":
      return RED.has(n);
    case "black":
      return !RED.has(n);
    case "even":
      return n % 2 === 0;
    case "odd":
      return n % 2 === 1;
    case "low":
      return n <= 18;
    case "high":
      return n >= 19;
    case "dozen1":
      return n <= 12;
    case "dozen2":
      return n >= 13 && n <= 24;
    case "dozen3":
      return n >= 25;
    default:
      return false;
  }
}

type RouletteConfig = { bet: BetKey; pick: number };
const DEFAULT: RouletteConfig = { bet: "none", pick: 17 };

const sanitize = (c: RouletteConfig): RouletteConfig => ({
  bet: BETS.some((b) => b.key === c.bet) ? c.bet : DEFAULT.bet,
  pick:
    Number.isInteger(c.pick) && c.pick >= 0 && c.pick <= 36
      ? c.pick
      : DEFAULT.pick,
});

/* ------------------------------------------------------------------ *
 * Geometry (unit circle, 0° = 12 o'clock, clockwise)
 * ------------------------------------------------------------------ */

const R_NUM_OUT = 0.95;
const R_NUM_IN = 0.79;
const R_POCKET_IN = 0.6;
/** Ball radius on the outer track, and where it settles in a pocket. */
const R_TRACK = 0.975;
const R_REST = 0.7;

const pt = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return `${stable(r * Math.sin(a))} ${stable(-r * Math.cos(a))}`;
};

const band = (r1: number, r2: number, a0: number, a1: number) =>
  `M ${pt(r2, a0)} A ${r2} ${r2} 0 0 1 ${pt(r2, a1)} L ${pt(r1, a1)} A ${r1} ${r1} 0 0 0 ${pt(r1, a0)} Z`;

/** Whole spin. Wheel and ball both come to rest exactly at the end of it. */
const SPIN_S = 4.2;
const mod360 = (a: number) => ((a % 360) + 360) % 360;

export default function RouletteEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<RouletteConfig>(DEFAULT);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ n: number; won: boolean | null } | null>(
    null,
  );
  const [recent, setRecent] = useState<number[]>([]);
  const [tally, setTally] = useState({ won: 0, lost: 0 });
  const [confetti, setConfetti] = useState(0);
  const reduce = useReducedMotion();

  /*
   * Same pattern as the coin: motion values, so nothing re-renders while the
   * wheel turns, and the result is read from the animation's own promise. The
   * wheel's target is computed from the winning pocket — never accumulated —
   * so the pocket under the ball is always the number announced.
   */
  const wheelRot = useMotionValue(0);
  const ballRot = useMotionValue(0);
  const ballR = useMotionValue(R_TRACK);
  const stageSize = useMotionValue(360);
  const ballY = useTransform([ballR, stageSize], ([r, s]) => -(r as number) * (s as number) / 2);

  const stageRef = useRef<HTMLDivElement>(null);
  const running = useRef<AnimationPlaybackControls[]>([]);
  const alive = useRef(true);
  const confettiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      running.current.forEach((c) => c.stop());
      running.current = [];
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
    };
  }, []);

  useEffect(() => {
    setCfg(sanitize(readConfig<RouletteConfig>(engine.slug, DEFAULT)));
  }, [engine.slug]);

  // The ball's offset is in px, so it tracks the stage's rendered size.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => stageSize.set(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [stageSize]);

  const persist = (patch: Partial<RouletteConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  const spin = async () => {
    if (spinning) return;
    const index = randomInt(0, WHEEL.length - 1);
    const n = WHEEL[index];
    const { bet, pick } = cfg;
    setSpinning(true);
    setResult(null);

    /*
     * Pocket `index` is centred at index·STEP on the wheel. The ball comes to
     * rest at 12 o'clock, so the wheel must finish at ≡ −index·STEP. It always
     * turns forwards (clockwise) by whole turns plus the remainder; the ball
     * runs the other way and finishes at ≡ 0.
     */
    const wStart = mod360(wheelRot.get());
    wheelRot.jump(wStart);
    const goal = mod360(-index * STEP);
    const wTarget =
      wStart + (reduce ? 0 : randomInt(2, 3)) * 360 + mod360(goal - wStart);

    const bStart = mod360(ballRot.get());
    ballRot.jump(bStart);
    const bTarget = bStart - (reduce ? 0 : randomInt(5, 6)) * 360 - bStart;

    const dur = reduce ? 0.5 : SPIN_S;
    const wheel = animate(wheelRot, wTarget, {
      duration: dur,
      ease: [0.12, 0.6, 0.25, 1],
    });
    const ball = animate(ballRot, bTarget, {
      duration: dur,
      ease: [0.2, 0.55, 0.3, 1],
    });
    // Rides the outer track, drops off it, clatters once and settles.
    const drop = reduce
      ? animate(ballR, R_REST, { duration: dur })
      : animate(ballR, [R_TRACK, R_TRACK, 0.82, 0.86, R_REST], {
          duration: dur,
          times: [0, 0.6, 0.76, 0.84, 1],
          ease: ["linear", "easeIn", "easeOut", "easeIn"],
        });
    running.current = [wheel, ball, drop];

    await Promise.all(running.current);
    if (!alive.current) return;
    running.current = [];

    const won = bet === "none" ? null : wins(bet, pick, n);
    setSpinning(false);
    setResult({ n, won });
    setRecent((r) => [n, ...r].slice(0, 12));
    if (won !== null) {
      setTally((t) => (won ? { ...t, won: t.won + 1 } : { ...t, lost: t.lost + 1 }));
    }
    if (won) {
      setConfetti((c) => c + 1);
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
      confettiTimer.current = setTimeout(() => setConfetti(0), 2600);
    }

    const color = colorOf(n);
    const name = `${n} ${color[0].toUpperCase()}${color.slice(1)}`;
    const betLabel =
      bet === "number" ? `#${pick}` : BETS.find((b) => b.key === bet)?.label;
    pushHistory({
      engineId: engine.slug,
      outcome:
        won === null ? name : `${name} — ${betLabel} ${won ? "won" : "lost"}`,
    });
  };

  const betDef = BETS.find((b) => b.key === cfg.bet)!;

  return (
    <EngineShell
      engine={engine}
      variant="warm"
      side={
        <>
          <SidePanel title="Your bet">
            <fieldset disabled={spinning} className="min-w-0 disabled:opacity-60">
              <div className="grid grid-cols-3 gap-2">
                {BETS.map((b) => (
                  <button
                    key={b.key}
                    onClick={() => persist({ bet: b.key })}
                    aria-pressed={cfg.bet === b.key}
                    className={
                      "rounded-xl px-2 py-2 text-xs font-medium transition-colors " +
                      (b.key === "none" ? "col-span-3 " : "") +
                      (cfg.bet === b.key
                        ? "bg-white text-ink-950"
                        : "bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white")
                    }
                  >
                    {b.key === "red" || b.key === "black" ? (
                      <span
                        className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                        style={{ background: FILL[b.key] , boxShadow: "0 0 0 1px rgba(255,255,255,0.3)" }}
                      />
                    ) : null}
                    {b.label}
                  </button>
                ))}
              </div>
              {cfg.bet === "number" && (
                <div className="mt-4">
                  <div className="mb-2 text-[11px] uppercase tracking-widest text-white/40">
                    Pick a number
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 37 }, (_, n) => (
                      <button
                        key={n}
                        onClick={() => persist({ pick: n })}
                        aria-pressed={cfg.pick === n}
                        aria-label={`Bet on ${n}`}
                        className={
                          "h-8 rounded-md text-xs font-semibold tabular-nums text-white transition-shadow " +
                          (n === 0 ? "col-span-7 " : "") +
                          (cfg.pick === n ? "ring-2 ring-white" : "ring-1 ring-white/10 hover:ring-white/40")
                        }
                        style={{ background: FILL[colorOf(n)] }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {betDef.pays && (
                <p className="mt-3 text-[11px] text-white/40">
                  Pays {betDef.pays}. Zero loses every bet except a straight bet on 0.
                </p>
              )}
            </fieldset>
          </SidePanel>

          <SidePanel title="Session">
            <div className="flex items-center justify-between text-sm">
              <div>
                <div className="text-2xl font-semibold tabular-nums text-emerald-300">
                  {tally.won}
                </div>
                <div className="text-xs text-white/50">Bets won</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold tabular-nums text-rose-300">
                  {tally.lost}
                </div>
                <div className="text-xs text-white/50">Bets lost</div>
              </div>
            </div>
            <div className="mt-4 text-[11px] uppercase tracking-widest text-white/40">
              Last spins
            </div>
            <div className="mt-2 flex min-h-7 flex-wrap gap-1.5">
              {recent.length === 0 ? (
                <span className="text-xs text-white/30">None yet</span>
              ) : (
                recent.map((n, i) => (
                  <span
                    key={recent.length - i}
                    className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold tabular-nums text-white ring-1 ring-white/15"
                    style={{ background: FILL[colorOf(n)], opacity: 1 - i * 0.06 }}
                  >
                    {n}
                  </span>
                ))
              )}
            </div>
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          {betDef.key === "none"
            ? "Place your bet — or just spin"
            : `Betting on ${cfg.bet === "number" ? cfg.pick : betDef.label}`}
        </p>

        <div
          ref={stageRef}
          className="relative aspect-square w-full max-w-[420px]"
        >
          {/* Ball marker at 12 o'clock. */}
          <div
            aria-hidden
            className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 -translate-y-1/2 border-x-[9px] border-t-[14px] border-x-transparent border-t-amber-300"
            style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}
          />

          {/* Static bowl: wooden rim and the ball track. */}
          <svg viewBox="-1 -1 2 2" className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <radialGradient id="roulette-rim" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse">
                <stop offset="0.9" stopColor="#5b3412" />
                <stop offset="0.96" stopColor="#8a5a2b" />
                <stop offset="1" stopColor="#3b1f0a" />
              </radialGradient>
            </defs>
            <circle r="1" fill="url(#roulette-rim)" />
            <circle r={R_TRACK} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.03" />
          </svg>

          {/*
            The wheel is one SVG rotated as a whole, with permanent
            `will-change`, so it is rasterized once and each frame is only a
            compositor transform.
          */}
          <motion.div
            className="absolute inset-0"
            style={{ rotate: wheelRot, willChange: "transform" }}
          >
            <Wheel />
          </motion.div>

          {/* Ball: an arm from the centre, rotated; the ball rides its tip. */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ rotate: ballRot, willChange: "transform" }}
          >
            <motion.div
              className="absolute left-1/2 top-1/2 rounded-full"
              style={{
                width: "4.6%",
                height: "4.6%",
                // Centred on the arm's pivot by margin (a % margin resolves
                // against the square stage's width), leaving `y` free for the
                // distance from the centre.
                marginLeft: "-2.3%",
                marginTop: "-2.3%",
                y: ballY,
                background:
                  "radial-gradient(circle at 35% 30%, #ffffff, #e5e7eb 45%, #9ca3af 100%)",
                boxShadow: "0 2px 4px rgba(0,0,0,0.6)",
                willChange: "transform",
              }}
            />
          </motion.div>
        </div>

        <div className="flex flex-col items-center gap-5">
          <div className="grid h-[84px] place-items-center" aria-live="polite">
            <AnimatePresence mode="wait">
              {result && !spinning && (
                <motion.div
                  key={recent.length}
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  className="flex flex-col items-center gap-2"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-12 w-12 place-items-center rounded-full text-xl font-bold tabular-nums text-white ring-2 ring-white/30"
                      style={{ background: FILL[colorOf(result.n)] }}
                    >
                      {result.n}
                    </span>
                    <span className="text-3xl font-semibold capitalize tracking-tight text-white">
                      {colorOf(result.n)}
                    </span>
                  </div>
                  {result.won !== null && (
                    <p
                      className={
                        "text-sm font-semibold " +
                        (result.won ? "text-emerald-300" : "text-rose-300")
                      }
                    >
                      {result.won ? `You win — pays ${betDef.pays}` : "House wins this one"}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <BigActionButton
            label={spinning ? "No more bets…" : "Spin"}
            onClick={spin}
            disabled={spinning}
            color="#dc2626"
            color2="#16a34a"
          />
        </div>
      </div>
      {confetti > 0 && <Confetti key={confetti} />}
    </EngineShell>
  );
}

/** The wheel face never changes, so it's built once and memoised. */
function Wheel() {
  const pockets = useMemo(
    () =>
      WHEEL.map((n, i) => {
        const a0 = i * STEP - STEP / 2;
        const a1 = i * STEP + STEP / 2;
        return {
          n,
          num: band(R_NUM_IN, R_NUM_OUT, a0, a1),
          pocket: band(R_POCKET_IN, R_NUM_IN, a0, a1),
          divider: `M ${pt(R_POCKET_IN, a0)} L ${pt(R_NUM_IN, a0)}`,
          rotate: stable(i * STEP),
          fill: FILL[colorOf(n)],
        };
      }),
    [],
  );

  return (
    <svg viewBox="-1 -1 2 2" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="roulette-cone" cx="0" cy="0" r={R_POCKET_IN} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#d4a017" />
          <stop offset="0.25" stopColor="#7a4b16" />
          <stop offset="1" stopColor="#3b2410" />
        </radialGradient>
      </defs>
      {pockets.map((p) => (
        <g key={p.n}>
          <path d={p.num} fill={p.fill} stroke="#d4a017" strokeWidth="0.004" />
          <path d={p.pocket} fill={p.fill} opacity={0.55} />
          <path d={p.divider} stroke="#d4a017" strokeWidth="0.006" />
          <text
            transform={`rotate(${p.rotate}) translate(0 ${-(R_NUM_IN + R_NUM_OUT) / 2})`}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="0.075"
            fontWeight="700"
            fill="#fff"
          >
            {p.n}
          </text>
        </g>
      ))}
      <circle r={R_NUM_OUT} fill="none" stroke="#d4a017" strokeWidth="0.008" />
      <circle r={R_POCKET_IN} fill="url(#roulette-cone)" stroke="#d4a017" strokeWidth="0.008" />
      {/* Turret */}
      {[0, 90, 180, 270].map((a) => (
        <line
          key={a}
          x1="0"
          y1="0"
          x2={stable(0.3 * Math.sin((a * Math.PI) / 180))}
          y2={stable(-0.3 * Math.cos((a * Math.PI) / 180))}
          stroke="#e5c07b"
          strokeWidth="0.035"
          strokeLinecap="round"
        />
      ))}
      <circle r="0.09" fill="#e5c07b" />
      <circle r="0.045" fill="#fff7e0" />
    </svg>
  );
}
