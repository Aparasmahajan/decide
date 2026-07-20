"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { Minus, Plus } from "lucide-react";

type BottleStyle = "bottle" | "arrow" | "sword" | "needle";
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

export default function BottleEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<BottleConfig>(DEFAULT);
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);

  useEffect(() => {
    setCfg(readConfig<BottleConfig>(engine.slug, DEFAULT));
  }, [engine.slug]);

  const persist = (patch: Partial<BottleConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  const spin = () => {
    if (spinning) return;
    const chosenIdx = Math.floor(Math.random() * cfg.people);
    const angleForIdx =
      -90 + (360 / cfg.people) * chosenIdx; // point at circle position
    const spins = 5 + Math.floor(Math.random() * 4);
    const jitter = (Math.random() - 0.5) * (360 / cfg.people) * 0.6;
    setRot(spins * 360 + angleForIdx + jitter);
    setSpinning(true);
    setChosen(null);
    setTimeout(() => {
      setSpinning(false);
      setChosen(chosenIdx);
      const label = cfg.names[chosenIdx] || `Person ${chosenIdx + 1}`;
      pushHistory({ engineId: engine.slug, outcome: label });
    }, 3800);
  };

  const positions = useMemo(() => {
    const arr: { x: number; y: number; angle: number }[] = [];
    for (let i = 0; i < cfg.people; i++) {
      const angle = (i / cfg.people) * 2 * Math.PI - Math.PI / 2;
      arr.push({
        x: Math.cos(angle) * 165,
        y: Math.sin(angle) * 165,
        angle,
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
          <SidePanel title="Players">
            <div className="flex items-center gap-3">
              <button
                onClick={() => persist({ people: Math.max(2, cfg.people - 1) })}
                className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="flex-1 rounded-xl bg-white/5 py-2 text-center text-xl font-semibold text-white ring-1 ring-white/10">
                {cfg.people}
              </div>
              <button
                onClick={() => persist({ people: Math.min(20, cfg.people + 1) })}
                className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </SidePanel>
          <SidePanel title="Pointer style">
            <div className="grid grid-cols-2 gap-2">
              {(["bottle", "arrow", "sword", "needle"] as BottleStyle[]).map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => persist({ style: s })}
                    className={
                      "rounded-xl px-3 py-2 text-sm capitalize transition-all " +
                      (cfg.style === s
                        ? "bg-white text-ink-950 shadow-glow"
                        : "bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white")
                    }
                  >
                    {s}
                  </button>
                ),
              )}
            </div>
          </SidePanel>
          <SidePanel title="Names (optional)">
            <textarea
              value={cfg.names.join("\n")}
              onChange={(e) =>
                persist({
                  names: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              rows={6}
              placeholder="One name per line"
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-white/25"
            />
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

        <div className="relative grid place-items-center">
          <div
            className="pointer-events-none absolute h-[420px] w-[420px] rounded-full opacity-60 blur-2xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(139,92,246,0.6), transparent 70%)",
            }}
          />
          <div className="relative grid h-[420px] w-[420px] place-items-center rounded-full border border-white/10 bg-white/[0.02] backdrop-blur">
            {/* Person avatars */}
            {positions.map((p, i) => {
              const label = cfg.names[i] || `${i + 1}`;
              const isChosen = chosen === i;
              return (
                <motion.div
                  key={i}
                  className="absolute grid place-items-center"
                  style={{
                    transform: `translate(${p.x}px, ${p.y}px)`,
                  }}
                  animate={
                    isChosen
                      ? { scale: [1, 1.25, 1.1], y: [0, -6, 0] }
                      : { scale: 1 }
                  }
                  transition={{ duration: 0.6 }}
                >
                  <div
                    className={
                      "grid h-14 w-14 place-items-center rounded-full text-sm font-semibold text-white shadow-soft-lg ring-1 transition-all " +
                      (isChosen
                        ? "ring-yellow-300 shadow-[0_0_40px_rgba(250,204,21,0.6)]"
                        : "ring-white/15")
                    }
                    style={{
                      background: `linear-gradient(135deg, hsl(${
                        (i * 47) % 360
                      }, 80%, 60%), hsl(${(i * 47 + 40) % 360}, 80%, 45%))`,
                    }}
                  >
                    {label.slice(0, 2).toUpperCase()}
                  </div>
                </motion.div>
              );
            })}

            {/* Pointer */}
            <motion.div
              animate={{ rotate: rot }}
              transition={{ duration: 3.8, ease: [0.16, 0.84, 0.28, 1] }}
              className="grid place-items-center"
              style={{ width: 300, height: 300 }}
            >
              <Pointer style={cfg.style} />
            </motion.div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-6">
          <AnimatePresence mode="wait">
            {chosen !== null && !spinning && (
              <motion.div
                key={chosen}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-white/50">
                  Points to
                </p>
                <p className="mt-1 text-4xl font-semibold tracking-tight text-white">
                  {cfg.names[chosen] || `Person ${chosen + 1}`}
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

function Pointer({ style }: { style: BottleStyle }) {
  if (style === "arrow") {
    return (
      <svg width="280" height="60" viewBox="0 0 280 60">
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
      <svg width="280" height="60" viewBox="0 0 280 60">
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
      <svg width="280" height="30" viewBox="0 0 280 30">
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
    <svg width="280" height="70" viewBox="0 0 280 70">
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
