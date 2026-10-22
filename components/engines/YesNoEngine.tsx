"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type AnimationPlaybackControls,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory } from "@/lib/storage";
import { randomInt } from "@/lib/random";

/** The whole flip, first turn to rest. */
const FLIP_S = 1.8;

export default function YesNoEngine({ engine }: { engine: EngineDef }) {
  const [flipping, setFlipping] = useState(false);
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);
  const reduce = useReducedMotion();

  /*
   * Driven by a motion value, like the coin: nothing re-renders mid-flip, and
   * the verdict is revealed when the animation's own promise resolves rather
   * than by a setTimeout kept in step with a transition duration by hand.
   */
  const rotY = useMotionValue(0);
  const running = useRef<AnimationPlaybackControls | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      running.current?.stop();
      running.current = null;
    };
  }, []);

  const flip = async () => {
    if (flipping) return;
    const outcome: "yes" | "no" = Math.random() < 0.5 ? "yes" : "no";
    setFlipping(true);
    setAnswer(null);

    /*
     * YES faces the viewer at rotateY ≡ 0 (mod 360), NO at ≡ 180.
     *
     * This had the coin's bug: it added `flips * 180 + (no ? 180 : 0)` to the
     * running rotation, so whenever `flips` came out odd the card picked up an
     * extra half-turn and landed on the opposite face from the verdict below
     * it. The target is now an absolute angle whose residue *is* the outcome.
     *
     * Worked example — showing NO (start 180), outcome YES, 2 turns: target is
     * 720. The YES card (own rotateY 0) ends at 720 ≡ 0: facing, unmirrored.
     * The NO card (own rotateY 180) ends at 900 ≡ 180: backface, hidden.
     *
     * The start is first folded into [0, 360) — visually identical — so the
     * angle can't grow without bound, and since every target is ≥ 360 the card
     * always turns forwards.
     */
    const start = ((rotY.get() % 360) + 360) % 360;
    rotY.jump(start);
    const target =
      (reduce ? 1 : randomInt(2, 3)) * 360 + (outcome === "yes" ? 0 : 180);

    const spin = animate(rotY, target, {
      duration: reduce ? 0.4 : FLIP_S,
      ease: [0.16, 0.84, 0.28, 1],
    });
    running.current = spin;

    await spin;
    if (!alive.current) return;
    running.current = null;

    setFlipping(false);
    setAnswer(outcome);
    pushHistory({
      engineId: engine.slug,
      outcome: outcome === "yes" ? "Yes" : "No",
    });
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
          {/*
            `will-change` is permanent so the faces' 3D layers exist before the
            first frame of a flip instead of being created on it.
          */}
          <motion.div
            className="preserve-3d relative"
            style={{ width: 260, height: 360, rotateY: rotY, willChange: "transform" }}
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
        // Faces sit 1px either side of the card's mid-plane. Coplanar, the
        // browser has no depth to sort them by and the hidden face can win.
        transform: flipped
          ? "rotateY(180deg) translateZ(1px)"
          : "translateZ(1px)",
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
