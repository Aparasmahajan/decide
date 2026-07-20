"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";

type PersonConfig = {
  count: number;
  names: string[];
};

const DEFAULT: PersonConfig = { count: 8, names: [] };

export default function PersonEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<PersonConfig>(DEFAULT);
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);

  useEffect(() => {
    setCfg(readConfig<PersonConfig>(engine.slug, DEFAULT));
  }, [engine.slug]);

  const persist = (patch: Partial<PersonConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

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
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      };
    });
  }, [cfg.count, radius]);

  const spin = () => {
    if (spinning) return;
    const idx = Math.floor(Math.random() * cfg.count);
    const target = -90 + (360 / cfg.count) * idx;
    const spins = 5 + Math.floor(Math.random() * 4);
    const jitter = (Math.random() - 0.5) * (360 / cfg.count) * 0.5;
    setRot(spins * 360 + target + jitter);
    setSpinning(true);
    setChosen(null);
    setTimeout(() => {
      setSpinning(false);
      setChosen(idx);
      const label = cfg.names[idx] || `Person ${idx + 1}`;
      pushHistory({ engineId: engine.slug, outcome: label });
    }, 3800);
  };

  return (
    <EngineShell
      engine={engine}
      variant="default"
      side={
        <>
          <SidePanel title="How many people?">
            <div>
              <input
                type="range"
                min={2}
                max={100}
                value={cfg.count}
                onChange={(e) =>
                  persist({ count: parseInt(e.target.value, 10) })
                }
                className="w-full accent-violet-400"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-white/60">
                <span>2</span>
                <span className="text-lg font-semibold text-white">
                  {cfg.count}
                </span>
                <span>100</span>
              </div>
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
            <p className="mt-2 text-[11px] text-white/40">
              Unnamed spots show as “Person N”.
            </p>
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          {cfg.count} people around the circle
        </p>

        <div className="relative grid place-items-center">
          <div
            className="pointer-events-none absolute h-[520px] w-[520px] rounded-full opacity-40 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(139,92,246,0.55), transparent 70%)",
            }}
          />
          <div className="relative h-[520px] w-[520px] rounded-full border border-white/10 bg-white/[0.02]">
            {positions.map((p, i) => {
              const isChosen = chosen === i;
              const label = cfg.names[i] || `${i + 1}`;
              return (
                <motion.div
                  key={i}
                  className="absolute left-1/2 top-1/2 grid place-items-center"
                  style={{
                    transform: `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)`,
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{
                    scale: isChosen ? 1.3 : 1,
                    opacity: 1,
                  }}
                  transition={{
                    delay: i * 0.008,
                    type: "spring",
                    stiffness: 220,
                    damping: 18,
                  }}
                >
                  <div
                    className={
                      "grid place-items-center rounded-full text-[10px] font-semibold text-white ring-1 transition-shadow " +
                      (isChosen
                        ? "ring-yellow-300 shadow-[0_0_30px_rgba(250,204,21,0.7)]"
                        : "ring-white/15")
                    }
                    style={{
                      width: dotSize,
                      height: dotSize,
                      background: `linear-gradient(135deg, hsl(${
                        (i * 37) % 360
                      }, 80%, 60%), hsl(${(i * 37 + 40) % 360}, 80%, 45%))`,
                      fontSize: Math.max(8, dotSize / 3),
                    }}
                    title={label}
                  >
                    {dotSize >= 20 ? label.slice(0, 2).toUpperCase() : ""}
                  </div>
                </motion.div>
              );
            })}
            <motion.div
              animate={{ rotate: rot }}
              transition={{ duration: 3.8, ease: [0.16, 0.84, 0.28, 1] }}
              className="absolute left-1/2 top-1/2 grid place-items-center"
              style={{ transform: "translate(-50%, -50%)" }}
            >
              <div
                className="h-1.5 rounded-full bg-gradient-to-r from-yellow-300 to-fuchsia-500 shadow-[0_0_20px_rgba(244,114,182,0.6)]"
                style={{ width: radius + 20 }}
              />
              <div className="absolute right-0 h-4 w-4 -translate-y-1/2 rounded-full bg-yellow-300 shadow-[0_0_20px_rgba(250,204,21,0.9)]" />
              <div className="absolute left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-white" />
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
                  Chosen
                </p>
                <p className="mt-1 text-4xl font-semibold tracking-tight text-white">
                  {cfg.names[chosen] || `Person ${chosen + 1}`}
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
