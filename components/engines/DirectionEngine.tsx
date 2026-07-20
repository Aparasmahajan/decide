"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";

type DirConfig = { customLabels: string; count: number };
const DEFAULT: DirConfig = { customLabels: "N,E,S,W", count: 4 };

export default function DirectionEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<DirConfig>(DEFAULT);
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    setCfg(readConfig<DirConfig>(engine.slug, DEFAULT));
  }, [engine.slug]);

  const persist = (patch: Partial<DirConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  const labels =
    cfg.customLabels
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) || ["N", "E", "S", "W"];

  const spin = () => {
    if (spinning) return;
    const idx = Math.floor(Math.random() * labels.length);
    const target = (360 / labels.length) * idx;
    const spins = 5 + Math.floor(Math.random() * 3);
    setRot(spins * 360 + target);
    setSpinning(true);
    setChosen(null);
    setTimeout(() => {
      setSpinning(false);
      setChosen(labels[idx]);
      pushHistory({ engineId: engine.slug, outcome: labels[idx] });
    }, 3600);
  };

  return (
    <EngineShell
      engine={engine}
      variant="cool"
      side={
        <SidePanel title="Directions">
          <input
            value={cfg.customLabels}
            onChange={(e) => persist({ customLabels: e.target.value })}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
            placeholder="N,E,S,W"
          />
          <p className="mt-2 text-[11px] text-white/40">
            Comma-separated. Any number of directions.
          </p>
        </SidePanel>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          Compass
        </p>
        <div className="relative grid place-items-center">
          <div
            className="absolute h-[400px] w-[400px] rounded-full opacity-50 blur-2xl"
            style={{
              background:
                "conic-gradient(from 0deg, rgba(56,189,248,0.5), rgba(139,92,246,0.5), rgba(244,114,182,0.5), rgba(56,189,248,0.5))",
            }}
          />
          <div className="relative grid h-[380px] w-[380px] place-items-center rounded-full border border-white/10 bg-white/[0.03]">
            {labels.map((l, i) => {
              const angle = (i / labels.length) * 360 - 90;
              return (
                <div
                  key={i}
                  className="absolute left-1/2 top-1/2 text-lg font-semibold text-white/60"
                  style={{
                    transform: `rotate(${angle}deg) translate(160px) rotate(${-angle}deg) translate(-50%, -50%)`,
                  }}
                >
                  {l}
                </div>
              );
            })}
            <motion.div
              animate={{ rotate: rot }}
              transition={{ duration: 3.6, ease: [0.16, 0.84, 0.28, 1] }}
              className="relative grid h-full w-full place-items-center"
            >
              {/* Needle */}
              <svg
                width="30"
                height="240"
                viewBox="0 0 30 240"
                className="drop-shadow-[0_0_20px_rgba(244,114,182,0.6)]"
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
        <div className="flex flex-col items-center gap-6">
          <AnimatePresence mode="wait">
            {chosen && !spinning && (
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
                <p className="mt-1 text-5xl font-semibold text-white">
                  {chosen}
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
