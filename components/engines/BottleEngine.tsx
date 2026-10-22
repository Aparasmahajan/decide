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
import { Minus, Plus } from "lucide-react";

type BottleStyle = "bottle" | "arrow" | "sword" | "needle";
const STYLES: BottleStyle[] = ["bottle", "arrow", "sword", "needle"];
type BottleConfig = {
  people: number;
  style: BottleStyle;
  names: string[];
};

const DEFAULT: BottleConfig = {
  people: 6,
  style: "bottle",
  names: [],
};

const MIN_PEOPLE = 2;
const MAX_PEOPLE = 20;
/** One spin, in seconds. The pick is revealed when the animation settles. */
const SPIN_S = 3.8;
const SPIN_EASE = [0.16, 0.84, 0.28, 1] as const;

/*
 * Stage geometry as fractions of the stage width (designed at 420px). The stage
 * shrinks to fit narrow screens — at a fixed 420px it overflowed every phone —
 * so everything on it is proportional.
 */
const SEAT_R = 165 / 420;
const AVATAR = 56 / 420;
const POINTER_W = 280 / 420;

const mod = (a: number, n: number) => ((a % n) + n) % n;
const clampPeople = (n: number) =>
  Number.isFinite(n)
    ? Math.min(MAX_PEOPLE, Math.max(MIN_PEOPLE, Math.round(n)))
    : DEFAULT.people;
const parseLines = (text: string) =>
  text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

function normalize(c: BottleConfig): BottleConfig {
  const names = Array.isArray(c.names)
    ? c.names.filter((n): n is string => typeof n === "string" && n.trim() !== "")
    : [];
  return {
    people: Math.max(clampPeople(c.people), Math.min(MAX_PEOPLE, names.length)),
    style: STYLES.includes(c.style) ? c.style : DEFAULT.style,
    names,
  };
}

export default function BottleEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<BottleConfig>(DEFAULT);
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
   * frame, and the pick is revealed when the animation resolves instead of by
   * a timeout hand-synced to the transition — one that also kept firing (and
   * writing history) after the page was left.
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
    const c = normalize(readConfig<BottleConfig>(engine.slug, DEFAULT));
    setCfg(c);
    setNamesText(c.names.join("\n"));
  }, [engine.slug]);

  const persist = (patch: Partial<BottleConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  // Every name gets a seat, so the seat count can't drop below the name count.
  const minPeople = Math.max(MIN_PEOPLE, Math.min(MAX_PEOPLE, cfg.names.length));

  const setPeople = (n: number) => {
    const people = Math.max(minPeople, clampPeople(n));
    if (people === cfg.people) return;
    // The seats are about to be re-laid out; the old pick no longer points at anyone.
    setChosen(null);
    persist({ people });
  };

  const setNames = (text: string) => {
    setNamesText(text);
    const names = parseLines(text);
    // Names past the seat count used to be silently unpickable; add seats instead.
    const people = Math.max(cfg.people, Math.min(MAX_PEOPLE, names.length));
    if (people !== cfg.people) setChosen(null);
    persist({ names, people });
  };

  const nameOf = (i: number) => cfg.names[i] || `Person ${i + 1}`;

  const spin = async () => {
    if (spinning) return;
    const n = cfg.people;
    const slot = 360 / n;
    const chosenIdx = Math.floor(Math.random() * n);
    const label = nameOf(chosenIdx);
    const jitter = (Math.random() - 0.5) * slot * 0.6;

    /*
     * Seat i sits at i·slot - 90° (clockwise from 3 o'clock; seat 0 at the
     * top), and the pointer's tip points along +x at rotation 0, so rotation R
     * aims it at R. Seat i is hit when R ≡ i·slot - 90 (mod 360).
     *
     * The old code set R = turns·360 + that angle measured from *zero* on every
     * spin, so a spin resting at 8 turns could be sent to 5 — whipping
     * backwards, or barely moving. The distance is now measured from where the
     * pointer is. e.g. 6 seats, resting at 2000° (≡ 200°), seat 2 (30°):
     * distance = mod(30 - 200, 360) = 190, final = 200 + turns·360 + 190 ≡ 30°.
     */
    const start = mod(rot.get(), 360);
    rot.jump(start); // same angle on screen; keeps the value from growing forever
    const turns = reduce ? 1 : 5 + Math.floor(Math.random() * 4);
    const target =
      start + turns * 360 + mod(chosenIdx * slot - 90 + jitter - start, 360);

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
    setChosen(chosenIdx);
    pushHistory({ engineId: engine.slug, outcome: label });
  };

  // Shrink avatars once a full table would make neighbours overlap.
  const avatar = Math.min(AVATAR, (0.8 * 2 * Math.PI * SEAT_R) / cfg.people);

  const positions = useMemo(() => {
    const arr: { left: number; top: number }[] = [];
    for (let i = 0; i < cfg.people; i++) {
      const angle = (i / cfg.people) * 2 * Math.PI - Math.PI / 2;
      arr.push({
        left: stable(50 + Math.cos(angle) * SEAT_R * 100),
        top: stable(50 + Math.sin(angle) * SEAT_R * 100),
      });
    }
    return arr;
  }, [cfg.people]);

  return (
    <EngineShell
      engine={engine}
      variant="aurora"
      side={
        <>
          {/*
            The panels are disabled mid-spin: changing the seat count re-lays
            the table under a pointer that's already aimed, and a renamed seat
            would no longer match the name being recorded.
          */}
          <SidePanel title="Players">
            <fieldset
              disabled={spinning}
              className="min-w-0 transition-opacity disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPeople(cfg.people - 1)}
                  disabled={cfg.people <= minPeople}
                  aria-label="Fewer players"
                  className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:hover:bg-white/5"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="flex-1 rounded-xl bg-white/5 py-2 text-center text-xl font-semibold text-white ring-1 ring-white/10">
                  {cfg.people}
                </div>
                <button
                  onClick={() => setPeople(cfg.people + 1)}
                  disabled={cfg.people >= MAX_PEOPLE}
                  aria-label="More players"
                  className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:hover:bg-white/5"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </fieldset>
          </SidePanel>
          <SidePanel title="Pointer style">
            <fieldset
              disabled={spinning}
              className="min-w-0 transition-opacity disabled:opacity-60"
            >
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s}
                    onClick={() => persist({ style: s })}
                    aria-pressed={cfg.style === s}
                    className={
                      "rounded-xl px-3 py-2 text-sm capitalize transition-all " +
                      (cfg.style === s
                        ? "bg-white text-ink-950 shadow-glow"
                        : "bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white")
                    }
                  >
                    {s}
                  </button>
                ))}
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
                {cfg.names.length > MAX_PEOPLE
                  ? `Only the first ${MAX_PEOPLE} names get a seat.`
                  : "Each name gets a seat; the rest are numbered."}
              </p>
            </fieldset>
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-white/40">
            Bottle Spin
          </p>
        </div>

        <div className="relative aspect-square w-full max-w-[420px]">
          <div
            className="pointer-events-none absolute inset-0 rounded-full opacity-60 blur-2xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(139,92,246,0.6), transparent 70%)",
            }}
          />
          {/*
            No `backdrop-blur` here. What's behind this circle is the drifting
            aurora, so the blur had to be recomputed every frame for as long as
            the page was open — and the only thing it softened was a glow that
            is already blurred.

            `container-type` makes `cqw` units below resolve against this
            circle, so avatar text scales with the stage.
          */}
          <div className="absolute inset-0 rounded-full border border-white/10 bg-white/[0.02] [container-type:inline-size]">
            {/* Person avatars */}
            {positions.map((p, i) => {
              const label = cfg.names[i] || `${i + 1}`;
              const isChosen = chosen === i;
              /*
                Seat position lives on a plain wrapper, the pop on the inner
                motion.div. They used to share one element, but framer-motion
                writes its own `transform` (built from scale / y) over a
                `transform` string in `style` — so the moment a seat was picked,
                its translate was dropped and the avatar jumped to the centre.
              */
              return (
                <div
                  key={i}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${p.left}%`,
                    top: `${p.top}%`,
                    width: `${avatar * 100}%`,
                  }}
                >
                  <motion.div
                    animate={
                      isChosen
                        ? { scale: [1, 1.25, 1.1], y: [0, -6, 0] }
                        : { scale: 1, y: 0 }
                    }
                    transition={{ duration: 0.6 }}
                  >
                    <div
                      className={
                        "grid aspect-square w-full place-items-center rounded-full text-sm font-semibold text-white shadow-soft-lg ring-1 transition-all " +
                        (isChosen
                          ? "ring-yellow-300 shadow-[0_0_40px_rgba(250,204,21,0.6)]"
                          : "ring-white/15")
                      }
                      style={{
                        background: `linear-gradient(135deg, hsl(${
                          (i * 47) % 360
                        }, 80%, 60%), hsl(${(i * 47 + 40) % 360}, 80%, 45%))`,
                        fontSize: `max(9px, ${avatar * 25}cqw)`,
                      }}
                      title={nameOf(i)}
                    >
                      {/* Array.from so an emoji isn't cut in half. */}
                      {Array.from(label).slice(0, 2).join("").toUpperCase()}
                    </div>
                  </motion.div>
                </div>
              );
            })}

            {/*
              Pointer. Centred by a static wrapper so the rotation is the only
              transform framer-motion owns. Rotation pivots on the pointer's
              own centre, which is the stage centre. `will-change` is permanent
              so the layer isn't created in the frame the spin starts.
            */}
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ width: `${POINTER_W * 100}%` }}
            >
              <motion.div style={{ rotate: rot, willChange: "transform" }}>
                <Pointer style={cfg.style} />
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
                  Points to
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-white [overflow-wrap:anywhere] sm:text-4xl">
                  {nameOf(chosen)}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <BigActionButton
            label={spinning ? "Spinning…" : "Spin the bottle"}
            onClick={spin}
            disabled={spinning}
            color="#22c55e"
            color2="#14b8a6"
          />
        </div>
      </div>
    </EngineShell>
  );
}

/** Each pointer's tip is at +x and its rotation pivot is the SVG's centre. */
function Pointer({ style }: { style: BottleStyle }) {
  if (style === "arrow") {
    return (
      <svg viewBox="0 0 280 60" className="block h-auto w-full">
        <defs>
          <linearGradient id="arrow" x1="0" x2="1">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#facc15" />
          </linearGradient>
        </defs>
        <polygon
          points="0,30 220,30 220,15 275,30 220,45 220,30"
          fill="url(#arrow)"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="1.5"
        />
      </svg>
    );
  }
  if (style === "sword") {
    return (
      <svg viewBox="0 0 280 60" className="block h-auto w-full">
        <defs>
          <linearGradient id="sword" x1="0" x2="1">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
        </defs>
        <rect x="20" y="27" width="200" height="6" fill="url(#sword)" />
        <polygon points="220,20 275,30 220,40" fill="#f8fafc" />
        <rect x="20" y="20" width="10" height="20" fill="#eab308" />
        <rect x="0" y="24" width="22" height="12" fill="#78350f" rx="3" />
      </svg>
    );
  }
  if (style === "needle") {
    return (
      <svg viewBox="0 0 280 30" className="block h-auto w-full">
        <defs>
          <linearGradient id="needle" x1="0" x2="1">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#facc15" />
          </linearGradient>
        </defs>
        <polygon points="0,15 260,10 275,15 260,20" fill="url(#needle)" />
        <circle cx="0" cy="15" r="6" fill="#f43f5e" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 280 70" className="block h-auto w-full">
      <defs>
        <linearGradient id="bottle" x1="0" x2="1">
          <stop offset="0%" stopColor="#166534" />
          <stop offset="50%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#14532d" />
        </linearGradient>
      </defs>
      {/* body */}
      <rect x="10" y="20" width="230" height="30" rx="10" fill="url(#bottle)" />
      {/* neck */}
      <rect x="235" y="28" width="30" height="14" rx="4" fill="#166534" />
      {/* cap */}
      <rect x="262" y="26" width="12" height="18" rx="2" fill="#eab308" />
      {/* highlight */}
      <rect x="20" y="24" width="200" height="5" rx="2" fill="rgba(255,255,255,0.25)" />
    </svg>
  );
}
