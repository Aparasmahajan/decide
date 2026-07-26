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

type TaskConfig = { tasks: string[]; removeAfter: boolean };
const DEFAULT: TaskConfig = {
  tasks: [
    "Do the dishes",
    "Take out the trash",
    "Reply to emails",
    "Go for a walk",
    "Tidy your desk",
  ],
  removeAfter: false,
};

export default function TaskEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<TaskConfig>(DEFAULT);
  const [current, setCurrent] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setCfg(readConfig<TaskConfig>(engine.slug, DEFAULT));
  }, [engine.slug]);

  const persist = (patch: Partial<TaskConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  const roll = () => {
    if (rolling || cfg.tasks.length === 0) return;
    setRolling(true);
    setDone(false);
    let n = 0;
    const iv = setInterval(() => {
      setCurrent(pick(cfg.tasks));
      n++;
      if (n > 18) {
        clearInterval(iv);
        const winner = pick(cfg.tasks);
        setCurrent(winner);
        setRolling(false);
        setDone(true);
        pushHistory({ engineId: engine.slug, outcome: winner });
        if (cfg.removeAfter) {
          persist({ tasks: cfg.tasks.filter((t) => t !== winner) });
        }
      }
    }, 85);
  };

  return (
    <EngineShell
      engine={engine}
      variant="cool"
      side={
        <>
          <SidePanel title="Tasks">
            <textarea
              value={cfg.tasks.join("\n")}
              onChange={(e) =>
                persist({
                  tasks: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              rows={10}
              placeholder="One task per line"
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-white/25"
            />
            <div className="mt-2 text-[11px] text-white/40">
              {cfg.tasks.length} tasks in the pool
            </div>
          </SidePanel>
          <SidePanel title="Modes">
            <label className="flex items-center justify-between text-sm text-white/80">
              <span>Remove after picking</span>
              <input
                type="checkbox"
                checked={cfg.removeAfter}
                onChange={(e) => persist({ removeAfter: e.target.checked })}
                className="h-4 w-4 accent-sky-400"
              />
            </label>
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          Your next task is…
        </p>
        <div className="grid flex-1 w-full place-items-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={current ?? "empty"}
              initial={{ y: 24, opacity: 0, filter: "blur(8px)" }}
              animate={{
                y: 0,
                opacity: 1,
                filter: "blur(0px)",
                scale: done ? [1, 1.06, 1] : 1,
              }}
              exit={{ y: -24, opacity: 0, filter: "blur(8px)" }}
              transition={{ duration: 0.15 }}
              className="max-w-full px-6 text-center text-4xl font-black tracking-tight text-gradient sm:text-6xl"
            >
              {current ?? "—"}
            </motion.div>
          </AnimatePresence>
        </div>
        <BigActionButton
          label={rolling ? "Choosing…" : "Pick a task"}
          onClick={roll}
          disabled={rolling || cfg.tasks.length === 0}
          color="#22c55e"
          color2="#0ea5e9"
        />
      </div>
    </EngineShell>
  );
}
