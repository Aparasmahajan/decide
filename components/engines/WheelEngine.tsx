"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { pickWeighted } from "@/lib/random";
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

const seedSlices = (): Slice[] =>
  ["Pizza", "Sushi", "Burgers", "Salad", "Tacos", "Ramen"].map((label, i) => ({
    id: Math.random().toString(36).slice(2, 9),
    label,
    color: PALETTE[i % PALETTE.length],
    weight: 1,
  }));

const DEFAULT: WheelConfig = { slices: seedSlices(), removeAfter: false };

export default function WheelEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<WheelConfig>(DEFAULT);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Slice | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    setCfg(readConfig<WheelConfig>(engine.slug, DEFAULT));
  }, [engine.slug]);

  const persist = (next: WheelConfig) => {
    setCfg(next);
    writeConfig(engine.slug, next);
  };

  const slices = cfg.slices;
  const totalWeight = useMemo(
    () => slices.reduce((s, i) => s + Math.max(0, i.weight), 0),
    [slices],
  );

  const spin = () => {
    if (spinning || slices.length < 2) return;
    const outcome = pickWeighted<Slice>(
      slices.map((s) => ({ value: s, weight: Math.max(0.001, s.weight) })),
    );
    // Determine target angle. The pointer is at the top (12 o'clock).
    let acc = 0;
    let idx = 0;
    for (let i = 0; i < slices.length; i++) {
      if (slices[i].id === outcome.id) {
        idx = i;
        break;
      }
      acc += slices[i].weight;
    }
    const w = outcome.weight;
    const start = (acc / totalWeight) * 360;
    const size = (w / totalWeight) * 360;
    const center = start + size / 2;
    // wheel drawn starting at -90 deg (top). We want the center to land at 0 (top).
    const targetOffset = -center - 90;
    const spins = 6 + Math.floor(Math.random() * 3);
    const extra = (Math.random() - 0.5) * (size * 0.6);
    setRotation(rotation + spins * 360 + targetOffset + extra);
    setSpinning(true);
    setWinner(null);
    setTimeout(() => {
      setSpinning(false);
      setWinner(outcome);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2400);
      pushHistory({ engineId: engine.slug, outcome: outcome.label });
      if (cfg.removeAfter) {
        persist({
          ...cfg,
          slices: slices.filter((s) => s.id !== outcome.id),
        });
      }
    }, 4200);
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
                      className="h-8 w-8 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                    />
                    <input
                      value={s.label}
                      onChange={(e) =>
                        updateSlice(s.id, { label: e.target.value.slice(0, 32) })
                      }
                      className="flex-1 rounded-lg bg-transparent px-1 py-1 text-sm text-white outline-none"
                    />
                    <input
                      type="number"
                      min={0.1}
                      max={20}
                      step={0.1}
                      value={s.weight}
                      onChange={(e) =>
                        updateSlice(s.id, {
                          weight: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="w-14 shrink-0 rounded-lg bg-white/5 px-2 py-1 text-right text-xs text-white/80 outline-none"
                      title="Weight"
                    />
                    <button
                      onClick={() => removeSlice(s.id)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/40 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
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
          </SidePanel>
          <SidePanel title="Modes">
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
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-white/40">
            Spin to decide
          </p>
        </div>
        <div className="relative grid place-items-center">
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
          <motion.svg
            width={360}
            height={360}
            viewBox="-1 -1 2 2"
            animate={{ rotate: rotation }}
            transition={{ duration: 4, ease: [0.16, 0.84, 0.28, 1] }}
            style={{
              transform: "rotate(-90deg)",
              filter:
                "drop-shadow(0 20px 40px rgba(0,0,0,0.4)) drop-shadow(0 0 40px rgba(139,92,246,0.35))",
            }}
          >
            {slices.length === 0 ? (
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
              slices.map((s, i) => {
                const start =
                  (slices.slice(0, i).reduce((a, b) => a + b.weight, 0) /
                    totalWeight) *
                  Math.PI *
                  2;
                const end = start + (s.weight / totalWeight) * Math.PI * 2;
                const x1 = Math.cos(start);
                const y1 = Math.sin(start);
                const x2 = Math.cos(end);
                const y2 = Math.sin(end);
                const large = end - start > Math.PI ? 1 : 0;
                const path = `M 0 0 L ${x1} ${y1} A 1 1 0 ${large} 1 ${x2} ${y2} Z`;
                const mid = (start + end) / 2;
                const tx = Math.cos(mid) * 0.62;
                const ty = Math.sin(mid) * 0.62;
                return (
                  <g key={s.id}>
                    <path
                      d={path}
                      fill={s.color}
                      stroke="rgba(255,255,255,0.15)"
                      strokeWidth="0.006"
                    />
                    <text
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="0.08"
                      fontWeight={700}
                      fill="white"
                      transform={`rotate(${(mid * 180) / Math.PI + 90}, ${tx}, ${ty})`}
                      style={{
                        paintOrder: "stroke",
                        stroke: "rgba(0,0,0,0.3)",
                        strokeWidth: 0.004,
                      }}
                    >
                      {s.label.slice(0, 14)}
                    </text>
                  </g>
                );
              })
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

        <div className="flex flex-col items-center gap-6">
          <AnimatePresence mode="wait">
            {winner && !spinning && (
              <motion.div
                key={winner.id}
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 250 }}
                className="text-center"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-white/50">
                  Winner
                </p>
                <p
                  className="mt-1 text-4xl font-semibold tracking-tight"
                  style={{ color: winner.color }}
                >
                  {winner.label}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <BigActionButton
            label={spinning ? "Spinning…" : "Spin the wheel"}
            onClick={spin}
            disabled={spinning || slices.length < 2}
            color="#38bdf8"
            color2="#a855f7"
          />
        </div>
      </div>

      {showConfetti && <Confetti />}
    </EngineShell>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 90 }, (_, i) => i);
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((i) => {
        const x = Math.random() * 100;
        const rot = Math.random() * 360;
        const delay = Math.random() * 0.4;
        const hue = Math.floor(Math.random() * 360);
        const size = 6 + Math.random() * 8;
        return (
          <motion.span
            key={i}
            initial={{ y: -40, x: `${x}vw`, opacity: 0, rotate: 0 }}
            animate={{
              y: "110vh",
              opacity: [0, 1, 1, 0],
              rotate: rot + 720,
            }}
            transition={{
              duration: 2 + Math.random(),
              delay,
              ease: "easeOut",
            }}
            style={{
              position: "absolute",
              width: size,
              height: size * 0.4,
              borderRadius: 2,
              background: `hsl(${hue} 90% 65%)`,
              boxShadow: `0 0 8px hsla(${hue},90%,60%,0.6)`,
            }}
          />
        );
      })}
    </div>
  );
}
