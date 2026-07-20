"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { pick } from "@/lib/random";

type NameConfig = { names: string[]; removeAfter: boolean };
const DEFAULT: NameConfig = {
  names: ["Ada", "Grace", "Alan", "Linus", "Margaret"],
  removeAfter: false,
};

export default function NameEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<NameConfig>(DEFAULT);
  const [current, setCurrent] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    setCfg(readConfig<NameConfig>(engine.slug, DEFAULT));
  }, [engine.slug]);

  const persist = (patch: Partial<NameConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  const pickWinner = () => {
    if (rolling || cfg.names.length === 0) return;
    setRolling(true);
    let n = 0;
    const iv = setInterval(() => {
      setCurrent(pick(cfg.names));
      n++;
      if (n > 20) {
        clearInterval(iv);
        const winner = pick(cfg.names);
        setCurrent(winner);
        setRolling(false);
        pushHistory({ engineId: engine.slug, outcome: winner });
        if (cfg.removeAfter) {
          persist({
            names: cfg.names.filter((n) => n !== winner),
          });
        }
      }
    }, 80);
  };

  return (
    <EngineShell
      engine={engine}
      variant="warm"
      side={
        <>
          <SidePanel title="Names">
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
              rows={10}
              placeholder="One name per line or CSV"
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-white/25"
            />
            <div className="mt-2 text-[11px] text-white/40">
              {cfg.names.length} names loaded
            </div>
          </SidePanel>
          <SidePanel title="Modes">
            <label className="flex items-center justify-between text-sm text-white/80">
              <span>Remove after selection</span>
              <input
                type="checkbox"
                checked={cfg.removeAfter}
                onChange={(e) => persist({ removeAfter: e.target.checked })}
                className="h-4 w-4 accent-fuchsia-400"
              />
            </label>
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          Pick a winner
        </p>
        <div className="grid flex-1 w-full place-items-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={current ?? "empty"}
              initial={{ y: 24, opacity: 0, filter: "blur(8px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: -24, opacity: 0, filter: "blur(8px)" }}
              transition={{ duration: 0.15 }}
              className="max-w-full truncate px-6 text-center text-[72px] font-black tracking-tighter text-gradient sm:text-[96px]"
            >
              {current ?? "—"}
            </motion.div>
          </AnimatePresence>
        </div>
        <BigActionButton
          label={rolling ? "Choosing…" : "Pick winner"}
          onClick={pickWinner}
          disabled={rolling || cfg.names.length === 0}
          color="#f97316"
          color2="#ef4444"
        />
      </div>
    </EngineShell>
  );
}
