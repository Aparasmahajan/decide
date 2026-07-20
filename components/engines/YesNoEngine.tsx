"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory } from "@/lib/storage";

export default function YesNoEngine({ engine }: { engine: EngineDef }) {
  const [flipping, setFlipping] = useState(false);
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);
  const [rot, setRot] = useState(0);

  const flip = () => {
    if (flipping) return;
    const outcome: "yes" | "no" = Math.random() > 0.5 ? "yes" : "no";
    const flips = 4 + Math.floor(Math.random() * 3);
    const final = flips * 180 + (outcome === "yes" ? 0 : 180);
    setRot((r) => r + final);
    setFlipping(true);
    setAnswer(null);
    setTimeout(() => {
      setFlipping(false);
      setAnswer(outcome);
      pushHistory({
        engineId: engine.slug,
        outcome: outcome === "yes" ? "Yes" : "No",
      });
    }, 1800);
  };

  return (
    <EngineShell
      engine={engine}
      variant="warm"
      side={
        <SidePanel title="About">
          <p className="text-sm text-white/60">
            Sometimes you already know the answer. Sometimes you just need it
            said out loud. This card is here for both.
          </p>
        </SidePanel>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          Yes / No
        </p>
        <div className="perspective-1000 grid flex-1 place-items-center">
          <motion.div
            className="preserve-3d relative"
            style={{ width: 260, height: 360 }}
            animate={{ rotateY: rot }}
            transition={{ duration: 1.8, ease: [0.16, 0.84, 0.28, 1] }}
          >
            <Card side="yes" />
            <Card side="no" flipped />
          </motion.div>
        </div>
        <div className="flex flex-col items-center gap-6">
          <AnimatePresence mode="wait">
            {answer && !flipping && (
              <motion.div
                key={answer}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-white/50">
                  The verdict
                </p>
                <p
                  className="mt-1 text-5xl font-semibold uppercase tracking-tight"
                  style={{
                    color: answer === "yes" ? "#22c55e" : "#ef4444",
                  }}
                >
                  {answer}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <BigActionButton
            label={flipping ? "Deciding…" : "Reveal answer"}
            onClick={flip}
            disabled={flipping}
            color="#a78bfa"
            color2="#f0abfc"
          />
        </div>
      </div>
    </EngineShell>
  );
}

function Card({ side, flipped }: { side: "yes" | "no"; flipped?: boolean }) {
  const isYes = side === "yes";
  return (
    <div
      className="backface-hidden absolute inset-0 grid place-items-center rounded-3xl"
      style={{
        background: isYes
          ? "linear-gradient(135deg, #16a34a 0%, #22d3ee 100%)"
          : "linear-gradient(135deg, #ef4444 0%, #f97316 100%)",
        boxShadow: `0 30px 60px -20px ${isYes ? "#16a34a99" : "#ef444499"}, inset 0 1px 0 rgba(255,255,255,0.2)`,
        transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
      }}
    >
      <div className="text-center">
        <div className="text-[13px] font-mono uppercase tracking-[0.4em] text-white/70">
          Verdict
        </div>
        <div className="mt-4 text-8xl font-black tracking-tighter text-white drop-shadow-lg">
          {isYes ? "YES" : "NO"}
        </div>
        <div className="mt-4 text-4xl">{isYes ? "✨" : "🚫"}</div>
      </div>
    </div>
  );
}
