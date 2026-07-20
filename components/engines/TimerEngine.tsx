"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { randomInt } from "@/lib/random";

type TimerConfig = { minSec: number; maxSec: number };
const DEFAULT: TimerConfig = { minSec: 10, maxSec: 60 };

export default function TimerEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<TimerConfig>(DEFAULT);
  const [target, setTarget] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    setCfg(readConfig<TimerConfig>(engine.slug, DEFAULT));
  }, [engine.slug]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const persist = (patch: Partial<TimerConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  const start = () => {
    if (running) return;
    const t = randomInt(cfg.minSec, cfg.maxSec);
    setTarget(t);
    setRemaining(t);
    setDone(false);
    setRunning(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r === null) return null;
        if (r <= 0.1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setRunning(false);
          setDone(true);
          pushHistory({
            engineId: engine.slug,
            outcome: `Timer ${t}s done`,
          });
          return 0;
        }
        return r - 0.1;
      });
    }, 100) as unknown as number;
  };

  const cancel = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setRemaining(null);
    setTarget(null);
    setDone(false);
  };

  const progress = target && remaining !== null ? 1 - remaining / target : 0;

  return (
    <EngineShell
      engine={engine}
      variant="aurora"
      side={
        <SidePanel title="Range">
          <div className="space-y-3">
            <NumInput
              label="Min (sec)"
              value={cfg.minSec}
              onChange={(v) => persist({ minSec: v })}
            />
            <NumInput
              label="Max (sec)"
              value={cfg.maxSec}
              onChange={(v) => persist({ maxSec: v })}
            />
          </div>
          <p className="mt-3 text-[11px] text-white/40">
            Great for kids, tasks, breaks, or games with variable timing.
          </p>
        </SidePanel>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          Surprise timer
        </p>
        <div className="relative grid flex-1 w-full place-items-center">
          <div className="relative">
            <svg width="320" height="320" viewBox="0 0 320 320">
              <defs>
                <linearGradient id="ring" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" />
                  <stop offset="100%" stopColor="#eab308" />
                </linearGradient>
              </defs>
              <circle
                cx="160"
                cy="160"
                r="140"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="14"
                fill="none"
              />
              <motion.circle
                cx="160"
                cy="160"
                r="140"
                stroke="url(#ring)"
                strokeWidth="14"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={2 * Math.PI * 140}
                initial={{ strokeDashoffset: 2 * Math.PI * 140 }}
                animate={{
                  strokeDashoffset: 2 * Math.PI * 140 * (1 - progress),
                }}
                transition={{ duration: 0.2, ease: "linear" }}
                transform="rotate(-90 160 160)"
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <AnimatePresence mode="wait">
                {done ? (
                  <motion.div
                    key="done"
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center"
                  >
                    <div className="text-6xl">⏰</div>
                    <div className="mt-1 text-2xl font-bold text-white">
                      Time's up!
                    </div>
                  </motion.div>
                ) : (
                  <div className="text-center">
                    <div className="text-7xl font-black tabular-nums text-gradient">
                      {remaining !== null
                        ? Math.ceil(remaining)
                        : target ?? "—"}
                    </div>
                    <div className="text-xs uppercase tracking-widest text-white/40">
                      {running ? "seconds left" : "seconds"}
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <BigActionButton
            label={running ? "Running…" : done ? "Roll another" : "Start"}
            onClick={running ? () => {} : start}
            disabled={running}
            color="#22c55e"
            color2="#eab308"
          />
          {(running || done) && (
            <button
              onClick={cancel}
              className="rounded-full bg-white/5 px-5 py-3 text-sm text-white/80 ring-1 ring-white/10 hover:bg-white/10"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </EngineShell>
  );
}

function NumInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-widest text-white/40">
        {label}
      </span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/25 focus:bg-white/10"
      />
    </label>
  );
}
