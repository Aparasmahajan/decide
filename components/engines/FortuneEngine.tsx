"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory } from "@/lib/storage";
import { pick } from "@/lib/random";

const FORTUNES = [
  "A soft answer turns away wrath.",
  "You will find something lost today.",
  "A pleasant surprise is waiting for you.",
  "Great things take time — be patient with yourself.",
  "Someone is thinking of you fondly right now.",
  "The best way to predict the future is to create it.",
  "A new idea will spark near water.",
  "You are exactly where you need to be.",
  "Say yes to the next small adventure.",
  "Your kindness will echo further than you know.",
  "Trust your first instinct — this time.",
  "A door you thought was closed is quietly open.",
  "Small joys will land in your lap this week.",
  "You already know the answer. Listen closer.",
  "A conversation you avoid will heal something.",
  "You will be admired for a choice made this month.",
];

export default function FortuneEngine({ engine }: { engine: EngineDef }) {
  const [cracked, setCracked] = useState(false);
  const [fortune, setFortune] = useState<string | null>(null);
  const [cracking, setCracking] = useState(false);

  const crack = () => {
    if (cracking) return;
    setCracking(true);
    setFortune(null);
    setTimeout(() => {
      setCracked(true);
      const f = pick(FORTUNES);
      setFortune(f);
      setCracking(false);
      pushHistory({ engineId: engine.slug, outcome: f });
    }, 900);
  };

  const reset = () => {
    setCracked(false);
    setFortune(null);
  };

  return (
    <EngineShell
      engine={engine}
      variant="warm"
      side={
        <SidePanel title="About">
          <p className="text-sm text-white/60">
            A little wisdom for the moment. Crack the cookie to reveal what
            fate suggests today.
          </p>
        </SidePanel>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          Fortune cookie
        </p>
        <div className="relative grid flex-1 w-full place-items-center">
          <AnimatePresence mode="wait">
            {!cracked ? (
              <motion.div
                key="cookie"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  rotate: cracking ? [0, -10, 10, -14, 14, 0] : 0,
                }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: cracking ? 0.5 : 0.4 }}
                className="text-[220px] leading-none drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
              >
                🥠
              </motion.div>
            ) : (
              <motion.div
                key="fortune"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 22 }}
                className="max-w-lg text-center"
              >
                <motion.p
                  initial={{ letterSpacing: "0.5em", opacity: 0 }}
                  animate={{ letterSpacing: "0em", opacity: 1 }}
                  transition={{ duration: 0.9 }}
                  className="text-3xl font-serif italic text-gradient-warm sm:text-4xl"
                >
                  “{fortune}”
                </motion.p>
                <p className="mt-6 text-xs uppercase tracking-widest text-white/40">
                  — the cookie
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {cracked ? (
          <BigActionButton
            label="Crack another"
            onClick={reset}
            color="#fbbf24"
            color2="#ef4444"
          />
        ) : (
          <BigActionButton
            label={cracking ? "Cracking…" : "Crack the cookie"}
            onClick={crack}
            disabled={cracking}
            color="#fbbf24"
            color2="#ef4444"
          />
        )}
      </div>
    </EngineShell>
  );
}
