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

type Prize = { label: string; weight: number };
type PrizeConfig = { prizes: Prize[]; removeAfter: boolean };
const DEFAULT: PrizeConfig = {
  prizes: [
    { label: "🥇 Grand Prize", weight: 1 },
    { label: "🥈 Runner-up", weight: 3 },
    { label: "🥉 Third Place", weight: 5 },
    { label: "🎟 Consolation", weight: 10 },
  ],
  removeAfter: false,
};

export default function PrizeEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<PrizeConfig>(DEFAULT);
  const [winner, setWinner] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    setCfg(readConfig<PrizeConfig>(engine.slug, DEFAULT));
  }, [engine.slug]);

  const persist = (patch: Partial<PrizeConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  const draw = () => {
    if (opening || cfg.prizes.length === 0) return;
    setOpening(true);
    setOpened(false);
    setWinner(null);
    setTimeout(() => {
      const w = pickWeighted(
        cfg.prizes.map((p) => ({ value: p.label, weight: p.weight })),
      );
      setWinner(w);
      setOpening(false);
      setOpened(true);
      pushHistory({ engineId: engine.slug, outcome: w });
      if (cfg.removeAfter) {
        persist({ prizes: cfg.prizes.filter((p) => p.label !== w) });
      }
    }, 1100);
  };

  const reset = () => {
    setOpened(false);
    setWinner(null);
  };

  const updatePrize = (i: number, patch: Partial<Prize>) => {
    persist({
      prizes: cfg.prizes.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    });
  };

  return (
    <EngineShell
      engine={engine}
      variant="warm"
      side={
        <>
          <SidePanel title="Prizes & odds">
            <div className="space-y-2">
              {cfg.prizes.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={p.label}
                    onChange={(e) => updatePrize(i, { label: e.target.value })}
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white outline-none focus:border-white/25"
                  />
                  <input
                    type="number"
                    min={0}
                    value={p.weight}
                    onChange={(e) =>
                      updatePrize(i, { weight: Math.max(0, +e.target.value) })
                    }
                    className="w-14 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white outline-none focus:border-white/25"
                    title="Relative odds"
                  />
                  <button
                    onClick={() =>
                      persist({
                        prizes: cfg.prizes.filter((_, idx) => idx !== i),
                      })
                    }
                    className="rounded-lg px-2 py-1.5 text-sm text-white/40 hover:bg-white/5 hover:text-white/80"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() =>
                persist({
                  prizes: [...cfg.prizes, { label: "New prize", weight: 1 }],
                })
              }
              className="mt-3 w-full rounded-lg border border-dashed border-white/15 py-2 text-sm text-white/60 hover:border-white/30 hover:text-white/90"
            >
              + Add prize
            </button>
          </SidePanel>
          <SidePanel title="Modes">
            <label className="flex items-center justify-between text-sm text-white/80">
              <span>Remove after draw</span>
              <input
                type="checkbox"
                checked={cfg.removeAfter}
                onChange={(e) => persist({ removeAfter: e.target.checked })}
                className="h-4 w-4 accent-rose-400"
              />
            </label>
            <p className="mt-2 text-[11px] text-white/40">
              Higher odds numbers are drawn more often.
            </p>
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          Draw the lucky one
        </p>
        <div className="relative grid flex-1 w-full place-items-center">
          <AnimatePresence mode="wait">
            {!opened ? (
              <motion.div
                key="box"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  y: opening ? [0, -14, 0, -8, 0] : 0,
                  rotate: opening ? [0, -6, 6, -4, 4, 0] : 0,
                }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ duration: opening ? 0.9 : 0.4 }}
                className="text-[200px] leading-none drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
              >
                🎁
              </motion.div>
            ) : (
              <motion.div
                key="winner"
                initial={{ opacity: 0, y: 24, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 18 }}
                className="text-center"
              >
                <div className="mb-3 text-6xl">🎉</div>
                <p className="max-w-lg px-6 text-4xl font-black tracking-tight text-gradient-warm sm:text-5xl">
                  {winner}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {opened ? (
          <BigActionButton
            label="Draw again"
            onClick={reset}
            color="#f43f5e"
            color2="#f59e0b"
          />
        ) : (
          <BigActionButton
            label={opening ? "Opening…" : "Draw a prize"}
            onClick={draw}
            disabled={opening || cfg.prizes.length === 0}
            color="#f43f5e"
            color2="#f59e0b"
          />
        )}
      </div>
    </EngineShell>
  );
}
