"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import EngineShell, {
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory } from "@/lib/storage";
import { pick } from "@/lib/random";

type Move = "rock" | "paper" | "scissors";

const MOVES: Move[] = ["rock", "paper", "scissors"];

const EMOJI: Record<Move, string> = {
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
};

/** Each move beats the one it maps to. */
const BEATS: Record<Move, Move> = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper",
};

/** From picking a move to Fate's hand landing. */
const THROW_MS = 1200;
/** How fast Fate's hand cycles while it's being thrown. */
const CYCLE_MS = 90;

type Outcome = "win" | "lose" | "draw";

export default function RPSEngine({ engine }: { engine: EngineDef }) {
  const [player, setPlayer] = useState<Move | null>(null);
  const [cpu, setCpu] = useState<Move | null>(null);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<Outcome | null>(null);
  const [stats, setStats] = useState({ win: 0, lose: 0, draw: 0 });
  /** Bumped per throw so both hands pop in again even when a move repeats. */
  const [round, setRound] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const play = (move: Move) => {
    if (rolling) return;
    const c = pick(MOVES);
    const r: Outcome = c === move ? "draw" : BEATS[move] === c ? "win" : "lose";
    setPlayer(move);
    setCpu(null);
    setResult(null);
    setRolling(true);
    setRound((n) => n + 1);
    timer.current = setTimeout(() => {
      timer.current = null;
      setCpu(c);
      setResult(r);
      setStats((s) => ({ ...s, [r]: s[r] + 1 }));
      setRolling(false);
      pushHistory({
        engineId: engine.slug,
        outcome: `You ${move} vs CPU ${c} — ${r.toUpperCase()}`,
      });
    }, THROW_MS);
  };

  return (
    <EngineShell
      engine={engine}
      variant="warm"
      side={
        <SidePanel title="Scoreboard">
          <div className="grid grid-cols-3 gap-2 text-center">
            {(["win", "draw", "lose"] as const).map((k) => (
              <div
                key={k}
                className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10"
              >
                <div className="text-2xl font-semibold tabular-nums text-white">
                  {stats[k]}
                </div>
                <div className="text-[10px] uppercase tracking-widest text-white/50">
                  {k}
                </div>
              </div>
            ))}
          </div>
        </SidePanel>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          You vs Fate
        </p>
        <div className="grid w-full grid-cols-3 items-center gap-2 py-8 sm:gap-6">
          <Hand label="You" move={player} round={round} rolling={false} align="right" />
          <div className="text-center text-2xl font-black text-white/40 sm:text-4xl">
            VS
          </div>
          <Hand label="Fate" move={cpu} round={round} rolling={rolling} align="left" />
        </div>

        <AnimatePresence mode="wait">
          {result && !rolling && (
            <motion.div
              key={result}
              initial={{ opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 250 }}
              className="text-center"
            >
              <p
                className="text-4xl font-bold uppercase tracking-tight"
                style={{
                  color:
                    result === "win"
                      ? "#22c55e"
                      : result === "lose"
                        ? "#ef4444"
                        : "#eab308",
                }}
              >
                {result === "win"
                  ? "You Win"
                  : result === "lose"
                    ? "You Lose"
                    : "Draw"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {MOVES.map((m) => (
            /*
              `transition-colors`, not `transition-all`, and no `backdrop-blur`.
              framer-motion writes `transform` every frame for the hover lift;
              a CSS transition on `all` then eased each of those writes too,
              so the button trailed the pointer. The blur re-sampled the panel
              behind on every one of those frames.
            */
            <motion.button
              key={m}
              whileHover={{ y: -3, scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => play(m)}
              disabled={rolling}
              aria-label={`Play ${m}`}
              className="group grid h-24 w-24 place-items-center rounded-3xl border border-white/10 bg-white/5 text-5xl shadow-soft-lg transition-colors hover:border-white/25 hover:bg-white/10 disabled:opacity-50"
            >
              {EMOJI[m]}
            </motion.button>
          ))}
        </div>
      </div>
    </EngineShell>
  );
}

/*
 * Two layers. The outer element only bobs while the hand is being thrown and
 * is never re-keyed. The inner one pops in once per throw, when the move is
 * known.
 *
 * It used to be a single element keyed by the current move. While rolling that
 * key changed every 90ms, so the hand was torn down and remounted at its
 * `initial` (scale 0.6, opacity 0) — which the bob never animated back — and
 * Fate's hand was invisible for the whole throw. If the final move matched the
 * last flicker it wasn't remounted at all and froze wherever the bob had left
 * it, mid-air.
 *
 * The cycling also lives here rather than in the engine, so it re-renders this
 * hand rather than the whole page eleven times a second.
 */
function Hand({
  label,
  move,
  round,
  rolling,
  align,
}: {
  label: string;
  move: Move | null;
  round: number;
  rolling: boolean;
  align: "left" | "right";
}) {
  const reduce = useReducedMotion();
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (!rolling) return;
    const id = setInterval(
      () => setCycle((i) => (i + 1) % MOVES.length),
      CYCLE_MS,
    );
    return () => clearInterval(id);
  }, [rolling]);

  const bob = rolling && !reduce;

  return (
    <div className="text-center">
      <div className="text-xs uppercase tracking-widest text-white/40">
        {label}
      </div>
      <div className="mt-1 flex justify-center">
        <motion.div
          animate={
            bob
              ? { y: [0, -20, 0], rotate: [0, -10, 10, 0] }
              : { y: 0, rotate: 0 }
          }
          transition={
            bob
              ? { duration: 0.5, repeat: Infinity, ease: "easeInOut" }
              : { type: "spring", stiffness: 300, damping: 20 }
          }
          className="text-7xl leading-none drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)] sm:text-[120px]"
          style={{ willChange: "transform" }}
        >
          {rolling ? (
            EMOJI[MOVES[cycle]]
          ) : (
            <motion.span
              key={`${round}-${move ?? "empty"}`}
              className="block"
              initial={{ scale: 0.6, opacity: 0, rotate: align === "left" ? -20 : 20 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              {move ? EMOJI[move] : "❔"}
            </motion.span>
          )}
        </motion.div>
      </div>
    </div>
  );
}
