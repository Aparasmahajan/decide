"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import EngineShell, {
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory } from "@/lib/storage";
import { pick } from "@/lib/random";

type Move = "rock" | "paper" | "scissors";

const EMOJI: Record<Move, string> = {
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
};

const BEATS: Record<Move, Move> = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper",
};

export default function RPSEngine({ engine }: { engine: EngineDef }) {
  const [player, setPlayer] = useState<Move | null>(null);
  const [cpu, setCpu] = useState<Move | null>(null);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<"win" | "lose" | "draw" | null>(null);
  const [stats, setStats] = useState({ win: 0, lose: 0, draw: 0 });

  const play = (move: Move) => {
    if (rolling) return;
    setPlayer(move);
    setCpu(null);
    setResult(null);
    setRolling(true);
    const iv = setInterval(() => setCpu(pick(["rock", "paper", "scissors"])), 90);
    setTimeout(() => {
      clearInterval(iv);
      const c = pick<Move>(["rock", "paper", "scissors"]);
      setCpu(c);
      const r =
        c === move
          ? "draw"
          : BEATS[move] === c
            ? "win"
            : "lose";
      setResult(r);
      setStats((s) => ({ ...s, [r]: s[r] + 1 }));
      setRolling(false);
      pushHistory({
        engineId: engine.slug,
        outcome: `You ${move} vs CPU ${c} — ${r.toUpperCase()}`,
      });
    }, 1200);
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
        <div className="grid w-full grid-cols-3 items-center gap-6 py-8">
          <Hand label="You" move={player} rolling={false} align="right" />
          <div className="text-center text-4xl font-black text-white/40">
            VS
          </div>
          <Hand label="Fate" move={cpu} rolling={rolling} align="left" />
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
          {(["rock", "paper", "scissors"] as Move[]).map((m) => (
            <motion.button
              key={m}
              whileHover={{ y: -3, scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => play(m)}
              disabled={rolling}
              className="group grid h-24 w-24 place-items-center rounded-3xl border border-white/10 bg-white/5 text-5xl shadow-soft-lg backdrop-blur transition-all hover:border-white/25 hover:bg-white/10 disabled:opacity-50"
            >
              {EMOJI[m]}
            </motion.button>
          ))}
        </div>
      </div>
    </EngineShell>
  );
}

function Hand({
  label,
  move,
  rolling,
  align,
}: {
  label: string;
  move: Move | null;
  rolling: boolean;
  align: "left" | "right";
}) {
  return (
    <div className={"text-center " + (align === "left" ? "text-left" : "text-right")}>
      <div className="text-xs uppercase tracking-widest text-white/40">
        {label}
      </div>
      <div className="mt-1 flex justify-center">
        <motion.div
          key={move ?? "empty"}
          initial={{ scale: 0.6, opacity: 0, rotate: align === "left" ? -20 : 20 }}
          animate={
            rolling
              ? { y: [0, -20, 0], rotate: [0, -10, 10, 0] }
              : { scale: 1, opacity: 1, rotate: 0 }
          }
          transition={{
            duration: rolling ? 0.5 : 0.4,
            repeat: rolling ? Infinity : 0,
            type: rolling ? "tween" : "spring",
            stiffness: 300,
          }}
          className="text-[120px] leading-none drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
        >
          {move ? EMOJI[move] : "❔"}
        </motion.div>
      </div>
    </div>
  );
}
