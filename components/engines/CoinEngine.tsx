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
import { useEffect, useRef, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { pickWeighted, randomInt } from "@/lib/random";
import { Crown, Palette, Star } from "lucide-react";

type Side = "heads" | "tails";

type CoinConfig = {
  headsLabel: string;
  tailsLabel: string;
  headsWeight: number;
  tailsWeight: number;
  skin: SkinKey;
};

type SkinKey = "gold" | "silver" | "neon" | "glass" | "wood" | "cyber";

const DEFAULT: CoinConfig = {
  headsLabel: "Heads",
  tailsLabel: "Tails",
  headsWeight: 1,
  tailsWeight: 1,
  skin: "gold",
};

const SKINS: Record<
  SkinKey,
  {
    name: string;
    face: string; // gradient
    edge: string;
    text: string;
    accent: string;
  }
> = {
  gold: {
    name: "Gold",
    face: "conic-gradient(from 210deg, #f7c948, #fef3c7, #d4a017, #f7c948, #fef7e6, #d4a017, #f7c948)",
    edge: "linear-gradient(180deg, #d4a017 0%, #a97a08 100%)",
    text: "#5a3a00",
    accent: "#f7c948",
  },
  silver: {
    name: "Silver",
    face: "conic-gradient(from 210deg, #d1d5db, #f9fafb, #9ca3af, #d1d5db, #ffffff, #9ca3af, #d1d5db)",
    edge: "linear-gradient(180deg, #9ca3af 0%, #4b5563 100%)",
    text: "#1f2937",
    accent: "#d1d5db",
  },
  neon: {
    name: "Neon",
    face: "conic-gradient(from 210deg, #a855f7, #38bdf8, #f472b6, #a855f7, #22d3ee, #f472b6, #a855f7)",
    edge: "linear-gradient(180deg, #6d28d9 0%, #4c1d95 100%)",
    text: "#fff",
    accent: "#a855f7",
  },
  glass: {
    name: "Glass",
    // Opaque enough that the far face can't show through the near one.
    face: "conic-gradient(from 210deg, #e5e7eb, #f8fafc, #cbd5e1, #e5e7eb, #ffffff, #cbd5e1, #e5e7eb)",
    edge: "linear-gradient(180deg, #cbd5e1, #94a3b8)",
    text: "#1f2937",
    accent: "#e5e7eb",
  },
  wood: {
    name: "Wood",
    face: "conic-gradient(from 210deg, #8b5a2b, #d4a373, #6b3410, #a97442, #d4a373, #6b3410, #8b5a2b)",
    edge: "linear-gradient(180deg, #6b3410 0%, #3f1d0a 100%)",
    text: "#3f1d0a",
    accent: "#8b5a2b",
  },
  cyber: {
    name: "Cyber",
    face: "conic-gradient(from 210deg, #06b6d4, #0ea5e9, #a855f7, #06b6d4, #22d3ee, #a855f7, #06b6d4)",
    edge: "linear-gradient(180deg, #0891b2 0%, #164e63 100%)",
    text: "#e0f2fe",
    accent: "#22d3ee",
  },
};

const COIN = 240;
/** Half the coin's thickness, in px. Faces sit at ±this on the Z axis. */
const HALF_THICK = 7;
/** Rim discs filling the gap between the faces, so the coin has an edge. */
const RIM_LAYERS = [-5, -2.5, 0, 2.5, 5];
const TOSS_HEIGHT = 150;
/** Whole flip, including the small bounce after landing. */
const FLIP_S = 1.6;
/** Fraction of FLIP_S at which the coin touches down and stops spinning. */
const LAND_AT = 0.8;

export default function CoinEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<CoinConfig>(DEFAULT);
  const [result, setResult] = useState<Side | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [flipCount, setFlipCount] = useState(0);
  const [stats, setStats] = useState({ heads: 0, tails: 0 });
  const [streak, setStreak] = useState<{ side: Side; n: number } | null>(null);
  const reduce = useReducedMotion();

  /*
   * The flip is driven by motion values rather than `animate` props + state.
   * Nothing re-renders while the coin is in the air, and the result is revealed
   * when the animation's own promise resolves — not by a setTimeout that has to
   * be kept in sync with a transition duration by hand.
   */
  const rotX = useMotionValue(0);
  const lift = useMotionValue(0);
  const coinScale = useTransform(lift, [-TOSS_HEIGHT, 0], [1.12, 1]);
  const shadowScale = useTransform(lift, [-TOSS_HEIGHT, 0], [0.45, 1]);
  const shadowOpacity = useTransform(lift, [-TOSS_HEIGHT, 0], [0.2, 0.65]);

  const running = useRef<AnimationPlaybackControls[]>([]);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      running.current.forEach((c) => c.stop());
      running.current = [];
    };
  }, []);

  useEffect(() => {
    const stored = readConfig<CoinConfig>(engine.slug, DEFAULT);
    setCfg({
      ...stored,
      // Older saves (or hand-edited storage) may name a skin that no longer exists.
      skin: stored.skin in SKINS ? stored.skin : DEFAULT.skin,
    });
  }, [engine.slug]);

  const setAndPersist = (patch: Partial<CoinConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  const skin = SKINS[cfg.skin];
  const headsLabel = cfg.headsLabel.trim() || DEFAULT.headsLabel;
  const tailsLabel = cfg.tailsLabel.trim() || DEFAULT.tailsLabel;
  const labelOf = (s: Side) => (s === "heads" ? headsLabel : tailsLabel);

  const flip = async () => {
    if (flipping) return;
    const outcome = pickWeighted<Side>([
      { value: "heads", weight: Math.max(0.001, cfg.headsWeight) },
      { value: "tails", weight: Math.max(0.001, cfg.tailsWeight) },
    ]);
    const label = labelOf(outcome);
    setFlipping(true);
    setResult(null);
    setFlipCount((c) => c + 1);

    /*
     * Heads faces the viewer at rotateX ≡ 0 (mod 360), tails at ≡ 180.
     *
     * The old code added `spins * 180 + (tails ? 180 : 0)` to the running
     * rotation. Whenever `spins` came out odd that added an extra half-turn, so
     * the coin landed on the opposite face from the result it announced. Here
     * the target is an absolute angle whose residue *is* the outcome, so the
     * face shown can't disagree with the result.
     *
     * The start is first folded back into [0, 360). That's visually identical,
     * and keeps the angle from growing without bound over a long session.
     */
    const start = ((rotX.get() % 360) + 360) % 360;
    rotX.jump(start);
    const target =
      (reduce ? 1 : randomInt(4, 6)) * 360 + (outcome === "heads" ? 0 : 180);

    const dur = reduce ? 0.4 : FLIP_S;
    const spin = animate(rotX, target, {
      duration: reduce ? dur : dur * LAND_AT,
      // Fast flick off the thumb, then a long, smooth settle.
      ease: [0.15, 0.5, 0.35, 1],
    });
    const toss = reduce
      ? null
      : animate(lift, [0, -TOSS_HEIGHT, 0, -12, 0], {
          duration: dur,
          times: [0, LAND_AT / 2, LAND_AT, (LAND_AT + 1) / 2, 1],
          ease: ["easeOut", "easeIn", "easeOut", "easeIn"],
        });
    running.current = toss ? [spin, toss] : [spin];

    await Promise.all(running.current);
    if (!alive.current) return;
    running.current = [];

    setFlipping(false);
    setResult(outcome);
    setStats((s) => ({ ...s, [outcome]: s[outcome] + 1 }));
    setStreak((s) =>
      s && s.side === outcome ? { side: outcome, n: s.n + 1 } : { side: outcome, n: 1 },
    );
    pushHistory({ engineId: engine.slug, outcome: label });
  };

  const total = stats.heads + stats.tails;

  return (
    <EngineShell
      engine={engine}
      variant="warm"
      side={
        <>
          <SidePanel title="Labels">
            <div className="space-y-3">
              <LabeledInput
                label="Heads"
                value={cfg.headsLabel}
                placeholder={DEFAULT.headsLabel}
                onChange={(v) => setAndPersist({ headsLabel: v })}
              />
              <LabeledInput
                label="Tails"
                value={cfg.tailsLabel}
                placeholder={DEFAULT.tailsLabel}
                onChange={(v) => setAndPersist({ tailsLabel: v })}
              />
            </div>
          </SidePanel>

          <SidePanel title="Weight">
            <div className="space-y-4">
              <RangeSlider
                label={headsLabel}
                value={cfg.headsWeight}
                onChange={(v) => setAndPersist({ headsWeight: v })}
              />
              <RangeSlider
                label={tailsLabel}
                value={cfg.tailsWeight}
                onChange={(v) => setAndPersist({ tailsWeight: v })}
              />
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-white/40">
                  Effective odds:{" "}
                  {formatPct(cfg.headsWeight, cfg.tailsWeight)} /{" "}
                  {formatPct(cfg.tailsWeight, cfg.headsWeight)}
                </p>
                {(cfg.headsWeight !== 1 || cfg.tailsWeight !== 1) && (
                  <button
                    onClick={() => setAndPersist({ headsWeight: 1, tailsWeight: 1 })}
                    className="rounded-lg px-2 py-1 text-[11px] text-white/50 transition-colors hover:bg-white/5 hover:text-white/80"
                  >
                    Reset to fair
                  </button>
                )}
              </div>
            </div>
          </SidePanel>

          <SidePanel title="Session stats">
            <div className="flex items-center justify-between text-sm">
              <StatCell label={headsLabel} value={stats.heads} total={total} accent="#facc15" />
              <StatCell label={tailsLabel} value={stats.tails} total={total} accent="#f472b6" />
            </div>
            {streak && streak.n > 1 && (
              <p className="mt-4 truncate text-xs text-white/50">
                Streak: <span className="text-white/80">{streak.n}× {labelOf(streak.side)}</span>
              </p>
            )}
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-10">
        {/* Skin picker */}
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-white/60">
            <Palette className="h-4 w-4" />
            <span className="text-xs uppercase tracking-widest">Skin</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SKINS) as SkinKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setAndPersist({ skin: k })}
                className={
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-all " +
                  (cfg.skin === k
                    ? "bg-white text-ink-950 shadow-glow"
                    : "bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white")
                }
              >
                {SKINS[k].name}
              </button>
            ))}
          </div>
        </div>

        {/* Coin — headroom above for the toss arc. */}
        <div className="relative grid w-full flex-1 place-items-center pt-24">
          <div
            className="perspective-1000 relative"
            style={{ width: COIN, height: COIN }}
          >
            {/*
              Ambient glow and ground shadow live outside the rotating element.
              As a `box-shadow` on the faces they spun round with the coin, and
              were re-rasterized with each face's layer.
            */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-4 rounded-full opacity-40 blur-2xl"
              style={{ background: skin.accent, y: lift, willChange: "transform" }}
            />
            <motion.div
              aria-hidden
              className="pointer-events-none absolute left-1/2 h-6 rounded-full"
              style={{
                width: COIN * 0.8,
                marginLeft: -COIN * 0.4,
                top: COIN + 18,
                background: `radial-gradient(closest-side, rgba(0,0,0,0.7), transparent)`,
                scaleX: shadowScale,
                opacity: shadowOpacity,
                willChange: "transform, opacity",
              }}
            />

            {/*
              `will-change` is set permanently. Toggling it on at the start of a
              flip and off at the end made the browser create the layer on the
              first frame of the spin and throw it away on landing — a hitch at
              both ends.
            */}
            <motion.div
              className="preserve-3d absolute inset-0"
              style={{
                y: lift,
                rotateX: rotX,
                scale: coinScale,
                willChange: "transform",
              }}
            >
              {RIM_LAYERS.map((z) => (
                <div
                  key={z}
                  aria-hidden
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: skin.edge,
                    transform: `translateZ(${z}px)`,
                  }}
                />
              ))}
              <CoinFace label={headsLabel} skin={skin} side="heads" />
              <CoinFace label={tailsLabel} skin={skin} side="tails" />
            </motion.div>
          </div>
        </div>

        {/* Result — fixed height so the button doesn't jump when it appears. */}
        <div className="flex flex-col items-center gap-6">
          <div className="grid h-[76px] place-items-center" aria-live="polite">
            <AnimatePresence mode="wait">
              {result && !flipping && (
                <motion.div
                  key={flipCount}
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  className="text-center"
                >
                  <p className="text-xs uppercase tracking-[0.24em] text-white/50">
                    Result
                  </p>
                  <p className="mt-1 max-w-[80vw] truncate text-4xl font-semibold tracking-tight text-white">
                    {labelOf(result)}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <BigActionButton
            label={flipping ? "Flipping…" : "Flip the coin"}
            onClick={flip}
            disabled={flipping}
            color="#f59e0b"
            color2="#ec4899"
          />
        </div>
      </div>
    </EngineShell>
  );
}

function CoinFace({
  label,
  skin,
  side,
}: {
  label: string;
  skin: (typeof SKINS)[SkinKey];
  side: Side;
}) {
  const Icon = side === "heads" ? Crown : Star;
  return (
    <div
      className="backface-hidden absolute inset-0 grid place-items-center rounded-full"
      style={{
        background: skin.face,
        boxShadow: "inset 0 0 40px rgba(0,0,0,0.25)",
        /*
         * The two faces used to share the same plane (z = 0), so the browser
         * had no depth to sort them by and either could win on a given frame —
         * the "Heads" face could paint over a coin that had landed tails.
         * Pushing them apart by the coin's thickness makes the order exact.
         */
        transform:
          side === "heads"
            ? `translateZ(${HALF_THICK}px)`
            : `rotateX(180deg) translateZ(${HALF_THICK}px)`,
        color: skin.text,
      }}
    >
      {/* Sheen. A plain gradient — a blend mode here forced a backdrop read on every frame of the spin. */}
      <div
        aria-hidden
        className="absolute inset-3 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.45), transparent 55%)",
        }}
      />
      <div
        className="relative grid h-40 w-40 place-items-center rounded-full border-2"
        style={{
          borderColor: `${skin.text}22`,
          background: `${skin.accent}22`,
        }}
      >
        <div className="flex flex-col items-center text-center">
          <Icon className="h-5 w-5 opacity-70" strokeWidth={2.25} />
          <div
            className={
              "mt-1 max-w-[9rem] truncate text-center font-bold tracking-tight " +
              (label.length > 10 ? "text-lg" : "text-2xl")
            }
          >
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-widest text-white/40">
        {label}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        maxLength={24}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/25 focus:bg-white/10"
      />
    </label>
  );
}

function RangeSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12px] text-white/70">
        <span className="truncate">{label}</span>
        <span className="tabular-nums text-white/50">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={5}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="mt-1 w-full accent-fuchsia-400"
      />
    </div>
  );
}

function StatCell({
  label,
  value,
  total,
  accent,
}: {
  label: string;
  value: number;
  total: number;
  accent: string;
}) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className="min-w-0 flex-1">
      <div
        className="text-2xl font-semibold tabular-nums"
        style={{ color: accent }}
      >
        {value}
      </div>
      <div className="max-w-full truncate text-xs text-white/60">{label}</div>
      <div className="mt-1 text-[10px] uppercase tracking-widest text-white/40">
        {pct}%
      </div>
    </div>
  );
}

/*
 * Mirrors `pickWeighted` above, which floors each weight at 0.001 — so two
 * zero weights are a fair coin, and a single zero weight is (very nearly) 0%.
 */
function formatPct(a: number, b: number) {
  const wa = Math.max(0.001, a);
  const wb = Math.max(0.001, b);
  return `${Math.round((wa / (wa + wb)) * 100)}%`;
}
