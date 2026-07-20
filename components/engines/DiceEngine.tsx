"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { randomInt } from "@/lib/random";
import { Minus, Plus } from "lucide-react";

type Sides = 4 | 6 | 8 | 10 | 12 | 20;

type DiceConfig = {
  count: number;
  sides: Sides;
  color: string;
};

const DEFAULT: DiceConfig = { count: 2, sides: 6, color: "#f472b6" };

const SIDES: Sides[] = [4, 6, 8, 10, 12, 20];

export default function DiceEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<DiceConfig>(DEFAULT);
  const [values, setValues] = useState<number[]>([]);
  const [rolling, setRolling] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const loaded = readConfig<DiceConfig>(engine.slug, DEFAULT);
    setCfg(loaded);
    setValues(Array.from({ length: loaded.count }, () => 1));
  }, [engine.slug]);

  const persist = (patch: Partial<DiceConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      if (patch.count !== undefined) {
        setValues(Array.from({ length: next.count }, () => 1));
      }
      return next;
    });
  };

  const total = useMemo(() => values.reduce((a, b) => a + b, 0), [values]);

  const roll = () => {
    if (rolling) return;
    setRolling(true);
    setTick((t) => t + 1);
    // fake tumble animation
    const intervalId = setInterval(() => {
      setValues(
        Array.from({ length: cfg.count }, () => randomInt(1, cfg.sides)),
      );
    }, 70);

    const duration = 1200 + Math.random() * 600;
    setTimeout(() => {
      clearInterval(intervalId);
      const finals = Array.from({ length: cfg.count }, () =>
        randomInt(1, cfg.sides),
      );
      setValues(finals);
      setRolling(false);
      pushHistory({
        engineId: engine.slug,
        outcome: `${finals.join(" + ")} = ${finals.reduce((a, b) => a + b, 0)} (${cfg.count}d${cfg.sides})`,
      });
    }, duration);
  };

  return (
    <EngineShell
      engine={engine}
      variant="cool"
      side={
        <>
          <SidePanel title="Dice type">
            <div className="grid grid-cols-3 gap-2">
              {SIDES.map((s) => (
                <button
                  key={s}
                  onClick={() => persist({ sides: s })}
                  className={
                    "rounded-xl px-3 py-2 text-sm font-medium transition-all " +
                    (cfg.sides === s
                      ? "bg-white text-ink-950 shadow-glow"
                      : "bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white")
                  }
                >
                  d{s}
                </button>
              ))}
            </div>
          </SidePanel>

          <SidePanel title="Count">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => persist({ count: Math.max(1, cfg.count - 1) })}
                className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="flex-1 rounded-xl bg-white/5 py-2 text-center text-xl font-semibold tabular-nums text-white ring-1 ring-white/10">
                {cfg.count}
              </div>
              <button
                onClick={() => persist({ count: Math.min(12, cfg.count + 1) })}
                className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </SidePanel>

          <SidePanel title="Color">
            <div className="flex flex-wrap gap-2">
              {[
                "#f472b6",
                "#a855f7",
                "#38bdf8",
                "#22c55e",
                "#facc15",
                "#f97316",
                "#ef4444",
                "#e2e8f0",
              ].map((c) => (
                <button
                  key={c}
                  onClick={() => persist({ color: c })}
                  className={
                    "h-8 w-8 rounded-full transition-transform hover:scale-110 " +
                    (cfg.color === c ? "ring-2 ring-white" : "ring-1 ring-white/10")
                  }
                  style={{ background: c }}
                />
              ))}
            </div>
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-10">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-white/40">
            Rolling
          </p>
          <p className="mt-1 text-lg font-medium text-white/80">
            {cfg.count} × d{cfg.sides}
          </p>
        </div>

        <div className="grid flex-1 place-items-center">
          <motion.div
            key={tick}
            initial={{ scale: 0.98 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 220 }}
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${Math.min(cfg.count, 6)}, minmax(0, 1fr))`,
            }}
          >
            {values.map((v, i) => (
              <DieVisual
                key={i}
                value={v}
                sides={cfg.sides}
                color={cfg.color}
                rolling={rolling}
                index={i}
              />
            ))}
          </motion.div>
        </div>

        <div className="flex flex-col items-center gap-6">
          <AnimatePresence mode="wait">
            {values.length > 0 && !rolling && (
              <motion.div
                key={values.join(",")}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-white/50">
                  Total
                </p>
                <p className="mt-1 text-5xl font-semibold tracking-tight text-white tabular-nums">
                  {total}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <BigActionButton
            label={rolling ? "Rolling…" : "Roll dice"}
            onClick={roll}
            disabled={rolling}
            color="#a855f7"
            color2="#ec4899"
          />
        </div>
      </div>
    </EngineShell>
  );
}

function DieVisual({
  value,
  sides,
  color,
  rolling,
  index,
}: {
  value: number;
  sides: Sides;
  color: string;
  rolling: boolean;
  index: number;
}) {
  const isCube = sides === 6;
  return (
    <motion.div
      animate={
        rolling
          ? {
              rotate: [0, 360, -180, 720, 0],
              y: [0, -20, 0, -10, 0],
            }
          : { rotate: 0, y: 0 }
      }
      transition={{
        duration: 1.2,
        repeat: rolling ? Infinity : 0,
        ease: "easeInOut",
        delay: index * 0.05,
      }}
      className="grid place-items-center"
      style={{ perspective: 800 }}
    >
      <div
        className="grid place-items-center rounded-2xl"
        style={{
          width: 92,
          height: 92,
          background: `linear-gradient(135deg, ${color}dd, ${color}77)`,
          boxShadow: `0 20px 40px -12px ${color}66, inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -6px 12px rgba(0,0,0,0.2)`,
        }}
      >
        {isCube ? (
          <PipFace value={value} />
        ) : (
          <div className="text-3xl font-bold tabular-nums text-white drop-shadow-md">
            {value}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function PipFace({ value }: { value: number }) {
  const positions: Record<number, [number, number][]> = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [
      [0, 0],
      [0, 2],
      [2, 0],
      [2, 2],
    ],
    5: [
      [0, 0],
      [0, 2],
      [1, 1],
      [2, 0],
      [2, 2],
    ],
    6: [
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 2],
      [2, 0],
      [2, 2],
    ],
  };
  const pips = positions[value] ?? [];
  return (
    <div
      className="grid h-16 w-16"
      style={{
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "repeat(3, 1fr)",
        gap: 4,
      }}
    >
      {Array.from({ length: 9 }).map((_, i) => {
        const r = Math.floor(i / 3);
        const c = i % 3;
        const on = pips.some(([pr, pc]) => pr === r && pc === c);
        return (
          <div
            key={i}
            className="rounded-full transition-all"
            style={{
              background: on ? "white" : "transparent",
              boxShadow: on ? "0 2px 6px rgba(0,0,0,0.35)" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
