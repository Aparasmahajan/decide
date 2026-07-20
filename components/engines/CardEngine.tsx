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

const SUITS = [
  { s: "♠", name: "Spades", color: "#e2e8f0" },
  { s: "♥", name: "Hearts", color: "#ef4444" },
  { s: "♦", name: "Diamonds", color: "#f97316" },
  { s: "♣", name: "Clubs", color: "#94a3b8" },
];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

type Card = { rank: string; suit: (typeof SUITS)[number] };

export default function CardEngine({ engine }: { engine: EngineDef }) {
  const [card, setCard] = useState<Card | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const draw = () => {
    if (drawing) return;
    setDrawing(true);
    setFlipped(false);
    setCard(null);

    setTimeout(() => {
      const c: Card = {
        rank: pick(RANKS),
        suit: pick(SUITS),
      };
      setCard(c);
      setFlipped(true);
      pushHistory({
        engineId: engine.slug,
        outcome: `${c.rank}${c.suit.s} ${c.suit.name}`,
      });
      setDrawing(false);
    }, 900);
  };

  return (
    <EngineShell
      engine={engine}
      variant="default"
      side={
        <SidePanel title="Deck">
          <p className="text-sm text-white/60">
            Standard 52-card deck. Each draw is independent — the deck is not
            depleted.
          </p>
        </SidePanel>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          Draw a card
        </p>

        <div className="perspective-1000 grid flex-1 place-items-center">
          <motion.div
            className="preserve-3d relative"
            style={{ width: 220, height: 320 }}
            animate={{
              rotateY: flipped ? 180 : 0,
              y: drawing ? -20 : 0,
              rotate: drawing ? [0, -3, 3, 0] : 0,
            }}
            transition={{
              rotateY: { duration: 0.8, ease: [0.2, 0.8, 0.2, 1] },
              y: { duration: 0.4 },
              rotate: {
                duration: 0.3,
                repeat: drawing ? Infinity : 0,
              },
            }}
          >
            {/* Back */}
            <div
              className="backface-hidden absolute inset-0 grid place-items-center rounded-2xl border border-white/10"
              style={{
                background:
                  "repeating-linear-gradient(45deg, #1e1b4b 0, #1e1b4b 8px, #312e81 8px, #312e81 16px)",
                boxShadow:
                  "0 20px 40px -10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              <div className="grid h-32 w-24 place-items-center rounded-xl border border-white/20 bg-white/5 backdrop-blur">
                <span className="text-4xl">🃏</span>
              </div>
            </div>
            {/* Front */}
            <div
              className="backface-hidden absolute inset-0 rounded-2xl border border-white/10 bg-white p-4"
              style={{
                transform: "rotateY(180deg)",
                boxShadow:
                  "0 20px 40px -10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.7)",
              }}
            >
              {card && (
                <div className="relative flex h-full flex-col justify-between text-slate-900">
                  <div
                    className="flex flex-col items-start"
                    style={{ color: card.suit.color === "#e2e8f0" || card.suit.color === "#94a3b8" ? "#0f172a" : card.suit.color }}
                  >
                    <span className="text-3xl font-bold leading-none">
                      {card.rank}
                    </span>
                    <span className="text-2xl">{card.suit.s}</span>
                  </div>
                  <div
                    className="grid place-items-center text-8xl"
                    style={{ color: card.suit.color === "#e2e8f0" || card.suit.color === "#94a3b8" ? "#0f172a" : card.suit.color }}
                  >
                    {card.suit.s}
                  </div>
                  <div
                    className="flex flex-col items-end rotate-180"
                    style={{ color: card.suit.color === "#e2e8f0" || card.suit.color === "#94a3b8" ? "#0f172a" : card.suit.color }}
                  >
                    <span className="text-3xl font-bold leading-none">
                      {card.rank}
                    </span>
                    <span className="text-2xl">{card.suit.s}</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        <div className="flex flex-col items-center gap-6">
          <AnimatePresence mode="wait">
            {card && flipped && !drawing && (
              <motion.div
                key={card.rank + card.suit.s}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <p className="text-lg font-semibold text-white">
                  {card.rank} of {card.suit.name}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <BigActionButton
            label={drawing ? "Drawing…" : "Draw card"}
            onClick={draw}
            disabled={drawing}
            color="#94a3b8"
            color2="#0f172a"
          />
        </div>
      </div>
    </EngineShell>
  );
}
