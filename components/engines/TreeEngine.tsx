"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";

type TreeConfig = { outcomes: string[] };
const DEFAULT: TreeConfig = {
  outcomes: ["Do it", "Don't", "Wait", "Ask someone"],
};

const W = 640;
const H = 320;
const MARGIN = 34;

export default function TreeEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<TreeConfig>(DEFAULT);
  const [step, setStep] = useState(-1); // how many levels revealed
  const [path, setPath] = useState<number[]>([]); // node index per level
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    setCfg(readConfig<TreeConfig>(engine.slug, DEFAULT));
    return () => timers.current.forEach(clearTimeout);
  }, [engine.slug]);

  const persist = (patch: Partial<TreeConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  const depth = useMemo(() => {
    const n = Math.max(2, cfg.outcomes.length);
    return Math.min(4, Math.max(1, Math.ceil(Math.log2(n))));
  }, [cfg.outcomes.length]);

  const nodePos = (level: number, idx: number) => {
    const count = 2 ** level;
    const x = (W * (idx + 0.5)) / count;
    const y = MARGIN + (level * (H - 2 * MARGIN)) / depth;
    return { x, y };
  };

  const decide = () => {
    if (running || cfg.outcomes.length === 0) return;
    setRunning(true);
    setOutcome(null);
    timers.current.forEach(clearTimeout);
    timers.current = [];

    // Build a random descent: bit per level, node index accumulates.
    const bits = Array.from({ length: depth }, () =>
      Math.random() < 0.5 ? 0 : 1,
    );
    const nodes: number[] = [0];
    for (let l = 0; l < depth; l++) {
      nodes.push(nodes[l] * 2 + bits[l]);
    }
    setPath(nodes);
    setStep(0);

    for (let l = 1; l <= depth; l++) {
      timers.current.push(setTimeout(() => setStep(l), l * 480));
    }
    timers.current.push(
      setTimeout(
        () => {
          const leaf = nodes[depth];
          const chosen = cfg.outcomes[leaf % cfg.outcomes.length];
          setOutcome(chosen);
          setRunning(false);
          pushHistory({ engineId: engine.slug, outcome: chosen });
        },
        depth * 480 + 200,
      ),
    );
  };

  // Precompute edges for rendering.
  const edges: { from: number[]; to: number[]; level: number; idx: number }[] =
    [];
  for (let l = 0; l < depth; l++) {
    const count = 2 ** l;
    for (let i = 0; i < count; i++) {
      const from = nodePos(l, i);
      edges.push({
        from: [from.x, from.y],
        to: [nodePos(l + 1, i * 2).x, nodePos(l + 1, i * 2).y],
        level: l,
        idx: i * 2,
      });
      edges.push({
        from: [from.x, from.y],
        to: [nodePos(l + 1, i * 2 + 1).x, nodePos(l + 1, i * 2 + 1).y],
        level: l,
        idx: i * 2 + 1,
      });
    }
  }

  const onPath = (level: number, idx: number) =>
    path.length > level && path[level] === idx && step >= level;

  return (
    <EngineShell
      engine={engine}
      variant="cool"
      side={
        <SidePanel title="Possible outcomes">
          <textarea
            value={cfg.outcomes.join("\n")}
            onChange={(e) =>
              persist({
                outcomes: e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            rows={8}
            placeholder="One outcome per line"
            className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-white/25"
          />
          <div className="mt-2 text-[11px] text-white/40">
            {cfg.outcomes.length} outcomes · {depth} branch levels
          </div>
        </SidePanel>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          Let the branches decide
        </p>

        <div className="grid flex-1 w-full place-items-center">
          <svg
            viewBox={`0 0 ${W} ${H + 40}`}
            className="w-full max-w-2xl"
            style={{ overflow: "visible" }}
          >
            {edges.map((e, i) => {
              const active = onPath(e.level + 1, e.idx);
              return (
                <line
                  key={`e${i}`}
                  x1={e.from[0]}
                  y1={e.from[1]}
                  x2={e.to[0]}
                  y2={e.to[1]}
                  stroke={active ? engine.color : "rgba(255,255,255,0.12)"}
                  strokeWidth={active ? 3 : 1.5}
                  strokeLinecap="round"
                  style={{ transition: "stroke 0.3s, stroke-width 0.3s" }}
                />
              );
            })}

            {Array.from({ length: depth + 1 }).map((_, level) => {
              const count = 2 ** level;
              return Array.from({ length: count }).map((__, idx) => {
                const { x, y } = nodePos(level, idx);
                const active = onPath(level, idx);
                const isLeaf = level === depth;
                return (
                  <g key={`n${level}-${idx}`}>
                    <motion.circle
                      cx={x}
                      cy={y}
                      r={active ? 9 : 5}
                      fill={active ? engine.color : "rgba(255,255,255,0.25)"}
                      animate={
                        active
                          ? { scale: [1, 1.6, 1] }
                          : { scale: 1 }
                      }
                      transition={{ duration: 0.4 }}
                      style={{ transformOrigin: `${x}px ${y}px` }}
                    />
                    {isLeaf && (
                      <text
                        x={x}
                        y={y + 26}
                        textAnchor="middle"
                        fontSize={11}
                        fill={active ? "#fff" : "rgba(255,255,255,0.4)"}
                        style={{ fontWeight: active ? 700 : 400 }}
                      >
                        {truncate(cfg.outcomes[idx % cfg.outcomes.length], 12)}
                      </text>
                    )}
                  </g>
                );
              });
            })}
          </svg>
        </div>

        <div className="flex min-h-[2.5rem] items-center justify-center">
          <AnimatePresence mode="wait">
            {outcome && (
              <motion.p
                key={outcome}
                initial={{ opacity: 0, y: 12, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
                className="text-3xl font-black tracking-tight text-gradient sm:text-4xl"
              >
                {outcome}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <BigActionButton
          label={running ? "Branching…" : "Grow the tree"}
          onClick={decide}
          disabled={running || cfg.outcomes.length === 0}
          color="#10b981"
          color2="#84cc16"
        />
      </div>
    </EngineShell>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
