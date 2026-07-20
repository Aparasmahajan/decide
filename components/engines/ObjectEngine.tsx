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

type ObjectConfig = { objects: string[]; removeAfter: boolean };
const DEFAULT: ObjectConfig = {
  objects: ["🍎", "📚", "🎸", "☕", "🔑", "🕯", "🧦", "🎧"],
  removeAfter: false,
};

export default function ObjectEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<ObjectConfig>(DEFAULT);
  const [current, setCurrent] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setCfg(readConfig<ObjectConfig>(engine.slug, DEFAULT));
  }, [engine.slug]);

  const persist = (patch: Partial<ObjectConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  const isEmoji = (s: string) => [...s].length <= 3 && /\p{Emoji}/u.test(s);

  const roll = () => {
    if (rolling || cfg.objects.length === 0) return;
    setRolling(true);
    setDone(false);
    let n = 0;
    const iv = setInterval(() => {
      setCurrent(pick(cfg.objects));
      n++;
      if (n > 20) {
        clearInterval(iv);
        const winner = pick(cfg.objects);
        setCurrent(winner);
        setRolling(false);
        setDone(true);
        pushHistory({ engineId: engine.slug, outcome: winner });
        if (cfg.removeAfter) {
          persist({ objects: cfg.objects.filter((o) => o !== winner) });
        }
      }
    }, 75);
  };

  const big = current ? isEmoji(current) : false;

  return (
    <EngineShell
      engine={engine}
      variant="default"
      side={
        <>
          <SidePanel title="Objects">
            <textarea
              value={cfg.objects.join("\n")}
              onChange={(e) =>
                persist({
                  objects: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              rows={10}
              placeholder="One object or emoji per line"
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-white/25"
            />
            <div className="mt-2 text-[11px] text-white/40">
              {cfg.objects.length} objects — emoji or text both work
            </div>
          </SidePanel>
          <SidePanel title="Modes">
            <label className="flex items-center justify-between text-sm text-white/80">
              <span>Remove after picking</span>
              <input
                type="checkbox"
                checked={cfg.removeAfter}
                onChange={(e) => persist({ removeAfter: e.target.checked })}
                className="h-4 w-4 accent-slate-300"
              />
            </label>
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          Pick an object
        </p>
        <div className="grid flex-1 w-full place-items-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={current ?? "empty"}
              initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
              animate={{
                scale: done ? [1, 1.12, 1] : 1,
                opacity: 1,
                rotate: 0,
              }}
              exit={{ scale: 0.6, opacity: 0, rotate: 8 }}
              transition={{ type: "spring", stiffness: 240, damping: 18 }}
              className={
                big
                  ? "text-[160px] leading-none drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)] sm:text-[200px]"
                  : "max-w-full px-6 text-center text-5xl font-black tracking-tight text-gradient sm:text-7xl"
              }
            >
              {current ?? "—"}
            </motion.div>
          </AnimatePresence>
        </div>
        <BigActionButton
          label={rolling ? "Choosing…" : "Pick an object"}
          onClick={roll}
          disabled={rolling || cfg.objects.length === 0}
          color="#94a3b8"
          color2="#e2e8f0"
        />
      </div>
    </EngineShell>
  );
}
