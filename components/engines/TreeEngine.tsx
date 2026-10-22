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
/** Delay between successive levels lighting up. */
const STEP_MS = 480;
/** Node pulse length. The outcome is revealed once the leaf's pulse is done. */
const PULSE_S = 0.4;
/** 2⁴ = 16 leaves is as wide as the tree gets while its labels stay legible. */
const MAX_DEPTH = 4;
const MAX_OUTCOMES = 2 ** MAX_DEPTH;

const parseLines = (text: string) =>
  text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

function normalize(c: TreeConfig): TreeConfig {
  return {
    outcomes: Array.isArray(c.outcomes)
      ? c.outcomes.filter((s): s is string => typeof s === "string" && s.trim() !== "")
      : DEFAULT.outcomes,
  };
}

export default function TreeEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<TreeConfig>(DEFAULT);
  /*
   * The textarea edits raw text; the config stores the parsed list. Deriving
   * the textarea from the parsed list (as before) stripped each newline and
   * trailing space the instant it was typed, so a second outcome could never
   * be started and "Ask someone" came out as "Asksomeone".
   */
  const [draft, setDraft] = useState(DEFAULT.outcomes.join("\n"));
  const [step, setStep] = useState(-1); // how many levels revealed
  const [path, setPath] = useState<number[]>([]); // node index per level
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const c = normalize(readConfig<TreeConfig>(engine.slug, DEFAULT));
    setCfg(c);
    setDraft(c.outcomes.join("\n"));
    return () => timers.current.forEach(clearTimeout);
  }, [engine.slug]);

  const persist = (patch: Partial<TreeConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  const onDraft = (text: string) => {
    setDraft(text);
    persist({ outcomes: parseLines(text) });
    // The leaves are relabelled (and the tree may change depth), so the old
    // highlighted path no longer leads to the outcome it announced.
    setPath([]);
    setStep(-1);
    setOutcome(null);
  };

  const items = cfg.outcomes.slice(0, MAX_OUTCOMES);
  const n = items.length;

  const depth = useMemo(() => {
    const k = Math.max(2, n);
    return Math.min(MAX_DEPTH, Math.max(1, Math.ceil(Math.log2(k))));
  }, [n]);

  const nodePos = (level: number, idx: number) => {
    const count = 2 ** level;
    const x = (W * (idx + 0.5)) / count;
    const y = MARGIN + (level * (H - 2 * MARGIN)) / depth;
    return { x, y };
  };

  const decide = () => {
    if (running || n === 0) return;
    setRunning(true);
    setOutcome(null);
    timers.current.forEach(clearTimeout);
    timers.current = [];

    /*
     * Pick the outcome first, uniformly, then one of the leaves that shows it,
     * and light the path down to that leaf.
     *
     * The old descent flipped a fair coin per level and took `leaf % n`. Unless
     * n is a power of two the leaves don't divide evenly — with 3 outcomes the
     * 4 leaves read A B C A, so A won half the time — and with more than 16
     * outcomes (the depth is capped at 4) everything past the 16th could never
     * be reached at all.
     *
     * The node at level l is the leaf's top l bits: leaf >> (depth - l).
     * e.g. 5 outcomes → depth 3, leaves read 0 1 2 3 4 0 1 2. Pick outcome 1 →
     * leaves {1, 6}; take 6 = 0b110 → path [0, 1, 3, 6]: right, right, left,
     * landing on leaf 6, labelled outcome 6 % 5 = 1.
     */
    const pickIdx = Math.floor(Math.random() * n);
    const leaves: number[] = [];
    for (let leaf = pickIdx; leaf < 2 ** depth; leaf += n) leaves.push(leaf);
    const leaf = leaves[Math.floor(Math.random() * leaves.length)];
    const nodes = Array.from({ length: depth + 1 }, (_, l) => leaf >> (depth - l));
    // Captured now: the outcomes can't be edited mid-run, but don't rely on it.
    const chosen = items[pickIdx];

    setPath(nodes);
    setStep(0);

    for (let l = 1; l <= depth; l++) {
      timers.current.push(setTimeout(() => setStep(l), l * STEP_MS));
    }
    timers.current.push(
      setTimeout(
        () => {
          setOutcome(chosen);
          setRunning(false);
          pushHistory({ engineId: engine.slug, outcome: chosen });
        },
        // After the leaf's pulse has finished, not 200ms into it.
        depth * STEP_MS + PULSE_S * 1000,
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
          {/* Disabled mid-run: an edit relabels the leaves under the path. */}
          <fieldset
            disabled={running}
            className="min-w-0 transition-opacity disabled:opacity-60"
          >
            <textarea
              value={draft}
              onChange={(e) => onDraft(e.target.value)}
              rows={8}
              placeholder="One outcome per line"
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-white/25"
            />
            <div className="mt-2 text-[11px] text-white/40">
              {cfg.outcomes.length > MAX_OUTCOMES
                ? `Only the first ${MAX_OUTCOMES} fit on the tree.`
                : n === 0
                  ? "Add at least one outcome."
                  : `${n} outcomes · ${depth} branch levels`}
            </div>
          </fieldset>
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
                // At 16 leaves neighbouring labels overprint; stagger them.
                const labelY =
                  y + (depth === MAX_DEPTH && idx % 2 === 1 ? 42 : 26);
                return (
                  <g key={`n${level}-${idx}`}>
                    {/*
                      No `transformOrigin`: framer-motion already centres SVG
                      transforms (`transform-box: fill-box`, origin 50% 50%).
                      The user-space px origin that was here is, under
                      fill-box, relative to the circle's own box — it only
                      worked because framer overwrote it while animating.
                    */}
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
                      transition={{ duration: PULSE_S }}
                    />
                    {isLeaf && (
                      <text
                        x={x}
                        y={labelY}
                        textAnchor="middle"
                        fontSize={11}
                        fill={active ? "#fff" : "rgba(255,255,255,0.4)"}
                        style={{ fontWeight: active ? 700 : 400 }}
                      >
                        {n > 0 ? truncate(items[idx % n], 12) : "—"}
                      </text>
                    )}
                  </g>
                );
              });
            })}
          </svg>
        </div>

        <div className="flex min-h-[2.5rem] max-w-full items-center justify-center">
          <AnimatePresence mode="wait">
            {outcome && (
              <motion.p
                key={outcome}
                initial={{ opacity: 0, y: 12, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
                className="max-w-full text-center text-3xl font-black tracking-tight text-gradient [overflow-wrap:anywhere] sm:text-4xl"
              >
                {outcome}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <BigActionButton
          label={running ? "Branching…" : "Grow the tree"}
          onClick={decide}
          disabled={running || n === 0}
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
