"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
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
const RANK_NAMES: Record<string, string> = {
  A: "Ace",
  J: "Jack",
  Q: "Queen",
  K: "King",
};

type Card = { rank: string; suit: (typeof SUITS)[number] };

const cardName = (c: Card) => `${RANK_NAMES[c.rank] ?? c.rank} of ${c.suit.name}`;
/** Spades and clubs are pale in the UI palette; on the white face they print dark. */
const inkOf = (c: Card) =>
  c.suit.s === "♠" || c.suit.s === "♣" ? "#0f172a" : c.suit.color;

/** The half-turn between face down and face up. */
const FLIP_MS = 800;
/**
 * The lifted, wiggling "draw" before the reveal. It must outlast FLIP_MS: a
 * card left face up turns face down during it, and the next card may only be
 * swapped onto the front once that old face has turned away.
 */
const SHUFFLE_MS = FLIP_MS + 100;

/** idle → shuffle (lift, wiggle, turn face down) → reveal (turn face up) → idle */
type Phase = "idle" | "shuffle" | "reveal";

export default function CardEngine({ engine }: { engine: EngineDef }) {
  const [card, setCard] = useState<Card | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [faceUp, setFaceUp] = useState(false);
  const reduce = useReducedMotion();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const drawing = phase !== "idle";

  /*
   * The old draw nulled the card and started the flip back in the same frame,
   * so the front swung through view as a blank white face; it then announced
   * the new card (and wrote history) the instant the reveal flip *started*,
   * 800ms before the face was actually showing. Now the old card keeps its
   * face until it has turned away, and the result lands when the flip does.
   */
  const draw = () => {
    if (drawing) return;
    const c: Card = { rank: pick(RANKS), suit: pick(SUITS) };
    setPhase("shuffle");
    setFaceUp(false);
    timers.current = [
      setTimeout(() => {
        setCard(c);
        setFaceUp(true);
        setPhase("reveal");
      }, SHUFFLE_MS),
      setTimeout(() => {
        setPhase("idle");
        pushHistory({
          engineId: engine.slug,
          outcome: `${c.rank}${c.suit.s} · ${cardName(c)}`,
        });
      }, SHUFFLE_MS + FLIP_MS),
    ];
  };

  const ink = card ? inkOf(card) : undefined;
  const wiggle = phase === "shuffle" && !reduce;

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
          {/*
            Back at rotateY(0), front pre-turned to rotateY(180), both with
            hidden backfaces. Container at 0: back is at 0 (facing), front at
            180 (hidden). Container at 180: back at 180 (hidden), front at
            360 ≡ 0 — facing, and not mirrored. `will-change` is permanent so
            the faces' 3D layers aren't created on the first frame of a flip.
          */}
          <motion.div
            className="preserve-3d relative"
            style={{ width: 220, height: 320, willChange: "transform" }}
            animate={{
              rotateY: faceUp ? 180 : 0,
              y: phase === "shuffle" ? -20 : 0,
              rotate: wiggle ? [0, -3, 3, 0] : 0,
            }}
            transition={{
              rotateY: { duration: FLIP_MS / 1000, ease: [0.2, 0.8, 0.2, 1] },
              y: { duration: 0.4 },
              rotate: {
                duration: 0.3,
                repeat: wiggle ? Infinity : 0,
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
              {/*
                Solid fill, not `backdrop-blur`: a backdrop filter inside a
                spinning 3D layer re-samples and re-blurs what's behind it on
                every frame of the flip. Blurred 8px stripes average to this
                colour anyway.
              */}
              <div
                className="grid h-32 w-24 place-items-center rounded-xl border border-white/20"
                style={{ background: "#322f6e" }}
              >
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
                  <div className="flex flex-col items-start" style={{ color: ink }}>
                    <span className="text-3xl font-bold leading-none">
                      {card.rank}
                    </span>
                    <span className="text-2xl">{card.suit.s}</span>
                  </div>
                  <div
                    className="grid place-items-center text-8xl"
                    style={{ color: ink }}
                  >
                    {card.suit.s}
                  </div>
                  <div
                    className="flex flex-col items-end rotate-180"
                    style={{ color: ink }}
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
            {card && faceUp && !drawing && (
              <motion.div
                key={card.rank + card.suit.s}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <p className="text-lg font-semibold text-white">
                  {cardName(card)}
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
