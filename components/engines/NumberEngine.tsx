"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { randomInt } from "@/lib/random";

type NumberConfig = { min: number; max: number; unique: boolean };
const DEFAULT: NumberConfig = { min: 1, max: 100, unique: false };

export default function NumberEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<NumberConfig>(DEFAULT);
  const [value, setValue] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [seen, setSeen] = useState<Set<number>>(new Set());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setCfg(readConfig<NumberConfig>(engine.slug, DEFAULT));
  }, [engine.slug]);

  const persist = (patch: Partial<NumberConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  const start = () => {
    if (rolling) return;
    const min = Math.min(cfg.min, cfg.max);
    const max = Math.max(cfg.min, cfg.max);

    let final = randomInt(min, max);
    if (cfg.unique) {
      const remaining: number[] = [];
      for (let n = min; n <= max; n++) {
        if (!seen.has(n)) remaining.push(n);
      }
      if (remaining.length === 0) {
        setSeen(new Set());
        final = randomInt(min, max);
      } else {
        final = remaining[Math.floor(Math.random() * remaining.length)];
      }
    }

    setRolling(true);
    const t0 = performance.now();
    const dur = 1400 + Math.random() * 400;
    const tick = () => {
      const t = (performance.now() - t0) / dur;
      if (t >= 1) {
        setValue(final);
        setRolling(false);
        if (cfg.unique) setSeen((s) => new Set(s).add(final));
        pushHistory({ engineId: engine.slug, outcome: String(final) });
        return;
      }
      // slow down towards end
      const ease = 1 - Math.pow(1 - t, 3);
      setValue(randomInt(min, max));
      const delay = 40 + ease * 260;
      rafRef.current = window.setTimeout(tick, delay) as unknown as number;
    };
    tick();
  };

  useEffect(() => () => {
    if (rafRef.current) clearTimeout(rafRef.current);
  }, []);

  return (
    <EngineShell
      engine={engine}
      variant="cool"
      side={
        <>
          <SidePanel title="Range">
            <div className="space-y-3">
              <NumInput
                label="Min"
                value={cfg.min}
                onChange={(v) => persist({ min: v })}
              />
              <NumInput
                label="Max"
                value={cfg.max}
                onChange={(v) => persist({ max: v })}
              />
            </div>
          </SidePanel>
          <SidePanel title="Mode">
            <label className="flex items-center justify-between text-sm text-white/80">
              <span>No repeats until exhausted</span>
              <input
                type="checkbox"
                checked={cfg.unique}
                onChange={(e) => {
                  persist({ unique: e.target.checked });
                  if (!e.target.checked) setSeen(new Set());
                }}
                className="h-4 w-4 accent-fuchsia-400"
              />
            </label>
            {cfg.unique && (
              <p className="mt-2 text-[11px] text-white/40">
                {seen.size} used · {Math.max(0, cfg.max - cfg.min + 1) - seen.size}{" "}
                remaining
              </p>
            )}
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-10">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          Between {cfg.min} and {cfg.max}
        </p>
        <div className="grid flex-1 place-items-center">
          <motion.div
            className="text-[160px] font-black leading-none tracking-tighter tabular-nums text-gradient"
            animate={rolling ? { scale: [1, 1.05, 1] } : { scale: 1 }}
            transition={{ duration: 0.15, repeat: rolling ? Infinity : 0 }}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {value ?? "–"}
          </motion.div>
        </div>
        <BigActionButton
          label={rolling ? "Choosing…" : "Generate"}
          onClick={start}
          disabled={rolling}
          color="#10b981"
          color2="#0ea5e9"
        />
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
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/25 focus:bg-white/10"
      />
    </label>
  );
}
