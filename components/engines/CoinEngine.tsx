"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { pickWeighted } from "@/lib/random";
import { Palette } from "lucide-react";

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
    face: "conic-gradient(from 210deg, rgba(255,255,255,0.6), rgba(255,255,255,0.15), rgba(255,255,255,0.4), rgba(255,255,255,0.6))",
    edge: "linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,255,255,0.15))",
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

export default function CoinEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<CoinConfig>(DEFAULT);
  const [result, setResult] = useState<Side | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [flipCount, setFlipCount] = useState(0);
  const [stats, setStats] = useState({ heads: 0, tails: 0 });

  useEffect(() => {
    setCfg(readConfig<CoinConfig>(engine.slug, DEFAULT));
  }, [engine.slug]);

  const setAndPersist = (patch: Partial<CoinConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  const skin = SKINS[cfg.skin];

  const flip = () => {
    if (flipping) return;
    const outcome = pickWeighted<Side>([
      { value: "heads", weight: Math.max(0.001, cfg.headsWeight) },
      { value: "tails", weight: Math.max(0.001, cfg.tailsWeight) },
    ]);
    setFlipping(true);
    setResult(null);
    const spins = 6 + Math.floor(Math.random() * 3);
    const finalRot = spins * 180 + (outcome === "heads" ? 0 : 180);
    setRotation((r) => r + finalRot);
    setFlipCount((c) => c + 1);
    setTimeout(() => {
      setFlipping(false);
      setResult(outcome);
      setStats((s) => ({
        ...s,
        [outcome]: s[outcome] + 1,
      }));
      pushHistory({
        engineId: engine.slug,
        outcome:
          outcome === "heads" ? cfg.headsLabel : cfg.tailsLabel,
      });
    }, 2200);
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
                onChange={(v) => setAndPersist({ headsLabel: v })}
              />
              <LabeledInput
                label="Tails"
                value={cfg.tailsLabel}
                onChange={(v) => setAndPersist({ tailsLabel: v })}
              />
            </div>
          </SidePanel>

          <SidePanel title="Weight">
            <div className="space-y-4">
              <RangeSlider
                label={`${cfg.headsLabel}`}
                value={cfg.headsWeight}
                onChange={(v) => setAndPersist({ headsWeight: v })}
              />
              <RangeSlider
                label={`${cfg.tailsLabel}`}
                value={cfg.tailsWeight}
                onChange={(v) => setAndPersist({ tailsWeight: v })}
              />
              <p className="text-[11px] text-white/40">
                Effective odds:{" "}
                {formatPct(cfg.headsWeight, cfg.tailsWeight)} /{" "}
                {formatPct(cfg.tailsWeight, cfg.headsWeight)}
              </p>
            </div>
          </SidePanel>

          <SidePanel title="Session stats">
            <div className="flex items-center justify-between text-sm">
              <StatCell label={cfg.headsLabel} value={stats.heads} total={total} accent="#facc15" />
              <StatCell label={cfg.tailsLabel} value={stats.tails} total={total} accent="#f472b6" />
            </div>
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-10">
        {/* Skin picker */}
        <div className="flex w-full items-center justify-between">
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

        {/* Coin */}
        <div className="perspective-1000 relative flex-1 grid place-items-center w-full">
          {/*
            No `key={flipCount}` here. Keying on the flip counter tore down and
            rebuilt the coin on every flip, which meant re-rasterizing two
            240px conic-gradient faces plus their inset shadows and 60px glow
            from scratch at the exact frame the spin started — a visible hitch
            on the first frame of every flip. `rotation` only ever increases, so
            animating it directly gives the same motion and lets the browser
            keep the already-painted faces.
          */}
          <motion.div
            aria-live="polite"
            className="preserve-3d relative"
            style={{
              width: 240,
              height: 240,
              willChange: flipping ? "transform" : undefined,
            }}
            animate={{ rotateX: rotation }}
            transition={{
              duration: 2.2,
              ease: [0.16, 0.84, 0.28, 1],
            }}
          >
            <CoinFace label={cfg.headsLabel} skin={skin} kind="H" />
            <CoinFace label={cfg.tailsLabel} skin={skin} kind="T" flipped />
            {/* Edge */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: skin.edge,
                transform: "rotateY(90deg) translateZ(0)",
                width: "100%",
                height: 24,
                top: "50%",
                marginTop: -12,
                opacity: 0.6,
              }}
            />
          </motion.div>

          {/* Landing glow */}
          <div
            className="pointer-events-none absolute bottom-6 h-6 w-56 rounded-full opacity-60 blur-2xl"
            style={{
              background: `radial-gradient(closest-side, ${skin.accent}, transparent 70%)`,
            }}
          />
        </div>

        {/* Result */}
        <div className="flex flex-col items-center gap-6">
          <AnimatePresence mode="wait">
            {result && !flipping && (
              <motion.div
                key={result + flipCount}
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="text-center"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-white/50">
                  Result
                </p>
                <p className="mt-1 text-4xl font-semibold tracking-tight text-white">
                  {result === "heads" ? cfg.headsLabel : cfg.tailsLabel}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
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
  kind,
  flipped,
}: {
  label: string;
  skin: (typeof SKINS)[SkinKey];
  kind: "H" | "T";
  flipped?: boolean;
}) {
  return (
    <div
      className="backface-hidden absolute inset-0 grid place-items-center rounded-full"
      style={{
        background: skin.face,
        boxShadow: `inset 0 0 40px rgba(0,0,0,0.25), 0 30px 60px -20px rgba(0,0,0,0.5), 0 0 60px ${skin.accent}55`,
        transform: flipped ? "rotateX(180deg)" : "rotateX(0deg)",
        color: skin.text,
      }}
    >
      <div className="relative grid place-items-center">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, rgba(255,255,255,0.5), transparent 70%)",
            mixBlendMode: "overlay",
            width: 220,
            height: 220,
            left: -110,
            top: -110,
          }}
        />
        <div
          className="grid h-40 w-40 place-items-center rounded-full border-2"
          style={{
            borderColor: `${skin.text}22`,
            background: `${skin.accent}22`,
          }}
        >
          <div className="text-center">
            <div className="text-[10px] font-mono uppercase tracking-[0.4em] opacity-70">
              {kind === "H" ? "OBVERSE" : "REVERSE"}
            </div>
            <div className="mt-1 max-w-[9rem] truncate text-center text-2xl font-bold tracking-tight">
              {label}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-widest text-white/40">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 24))}
        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/25 focus:bg-white/10"
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
        <span>{label}</span>
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
    <div className="flex-1">
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

function formatPct(a: number, b: number) {
  const t = a + b;
  if (t === 0) return "50%";
  return `${Math.round((a / t) * 100)}%`;
}
