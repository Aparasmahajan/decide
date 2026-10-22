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

/*
 * The twenty classic answers: ten yes, five maybe, five no. "It is decidedly
 * so." and "Yes." were missing, which quietly tilted the ball from an even
 * 50% yes to 8 in 18.
 */
const ANSWERS = [
  { text: "It is certain.", tone: "yes" },
  { text: "It is decidedly so.", tone: "yes" },
  { text: "Without a doubt.", tone: "yes" },
  { text: "Yes — definitely.", tone: "yes" },
  { text: "You may rely on it.", tone: "yes" },
  { text: "As I see it, yes.", tone: "yes" },
  { text: "Most likely.", tone: "yes" },
  { text: "Outlook good.", tone: "yes" },
  { text: "Yes.", tone: "yes" },
  { text: "Signs point to yes.", tone: "yes" },
  { text: "Reply hazy, try again.", tone: "maybe" },
  { text: "Ask again later.", tone: "maybe" },
  { text: "Better not tell you now.", tone: "maybe" },
  { text: "Cannot predict now.", tone: "maybe" },
  { text: "Concentrate and ask again.", tone: "maybe" },
  { text: "Don't count on it.", tone: "no" },
  { text: "My reply is no.", tone: "no" },
  { text: "My sources say no.", tone: "no" },
  { text: "Outlook not so good.", tone: "no" },
  { text: "Very doubtful.", tone: "no" },
] as const;

/** The shake itself. */
const SHAKE_MS = 1400;
/** The beat between the ball coming to rest and the answer floating up. */
const SETTLE_MS = 200;

export default function Magic8Engine({ engine }: { engine: EngineDef }) {
  const [question, setQuestion] = useState("");
  const [shaking, setShaking] = useState(false);
  const [answer, setAnswer] = useState<(typeof ANSWERS)[number] | null>(null);
  const reduce = useReducedMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const shake = () => {
    if (shaking) return;
    // The question as it was when the ball was shaken, not as edited since.
    const asked = question.trim();
    setShaking(true);
    setAnswer(null);
    timer.current = setTimeout(() => {
      timer.current = null;
      const a = pick([...ANSWERS]);
      setAnswer(a);
      setShaking(false);
      pushHistory({
        engineId: engine.slug,
        outcome: `${asked ? `“${asked}” → ` : ""}${a.text}`,
      });
    }, SHAKE_MS + SETTLE_MS);
  };

  const toneColor =
    answer?.tone === "yes"
      ? "#22c55e"
      : answer?.tone === "no"
        ? "#ef4444"
        : "#eab308";

  return (
    <EngineShell
      engine={engine}
      variant="cool"
      side={
        <SidePanel title="How to use">
          <ol className="space-y-2 text-sm text-white/70">
            <li>1. Type your yes/no question.</li>
            <li>2. Shake the ball (or press Enter).</li>
            <li>3. Trust the answer.</li>
          </ol>
        </SidePanel>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <label className="w-full">
          <span className="text-xs uppercase tracking-widest text-white/40">
            Your question
          </span>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              // Not while an IME is composing: that Enter confirms the text.
              if (e.key === "Enter" && !e.nativeEvent.isComposing) shake();
            }}
            placeholder="Should I…?"
            maxLength={140}
            enterKeyHint="go"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-lg text-white outline-none transition-colors focus:border-white/25 focus:bg-white/10"
          />
        </label>

        <div className="relative grid place-items-center">
          {/*
            `will-change` is permanent. Without its own layer the ball — big
            radial gradient, three stacked shadows and a blurred highlight — was
            repainted on every frame of the shake just to be moved sideways.
          */}
          <motion.div
            animate={
              shaking && !reduce
                ? { x: [0, -20, 20, -14, 14, -8, 8, 0], rotate: [0, -8, 8, -4, 4, 0] }
                : { x: 0, rotate: 0 }
            }
            transition={{ duration: SHAKE_MS / 1000 }}
            className="relative grid h-64 w-64 place-items-center rounded-full sm:h-72 sm:w-72"
            style={{
              background:
                "radial-gradient(circle at 30% 25%, #1e40af 0%, #0b1e3f 50%, #020617 90%)",
              boxShadow:
                "inset 0 -30px 60px rgba(0,0,0,0.6), inset 0 10px 30px rgba(255,255,255,0.15), 0 40px 80px -20px rgba(0,0,0,0.7)",
              willChange: "transform",
            }}
          >
            {/* highlight */}
            <div
              className="absolute -top-2 left-6 h-16 w-24 rounded-full"
              style={{
                background:
                  "radial-gradient(ellipse, rgba(255,255,255,0.5), transparent 70%)",
                filter: "blur(4px)",
              }}
            />
            {/* window */}
            <div
              className="relative grid h-40 w-40 place-items-center rounded-full text-center"
              style={{
                background:
                  "radial-gradient(circle at 50% 40%, #1e293b 0%, #020617 90%)",
                boxShadow:
                  "inset 0 0 40px rgba(0,0,0,0.9), inset 0 0 0 2px rgba(255,255,255,0.05)",
              }}
            >
              <AnimatePresence mode="wait">
                {shaking ? (
                  /*
                    The exit needs its own transition. Without one it inherited
                    the pulse's `repeat: Infinity`, so the fade-out never
                    finished — and under `mode="wait"` the answer can't mount
                    until it does.
                  */
                  <motion.div
                    key="shaking"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.3, 0.9, 0.3] }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={{
                      duration: 0.5,
                      repeat: Infinity,
                    }}
                    className="text-4xl"
                  >
                    ⋯
                  </motion.div>
                ) : answer ? (
                  <motion.div
                    key={answer.text}
                    initial={{ opacity: 0, scale: 0.7, rotateX: 90 }}
                    animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 200,
                      damping: 20,
                    }}
                    className="px-4 text-sm font-semibold leading-tight"
                    style={{ color: toneColor }}
                  >
                    {answer.text}
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.6 }}
                    exit={{ opacity: 0 }}
                    className="grid h-16 w-16 place-items-center rounded-full text-2xl font-bold"
                    style={{
                      color: "#38bdf8",
                      background: "rgba(56,189,248,0.1)",
                    }}
                  >
                    8
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        <BigActionButton
          label={shaking ? "Shaking…" : "Shake"}
          onClick={shake}
          disabled={shaking}
          color="#0ea5e9"
          color2="#1e3a8a"
        />
      </div>
    </EngineShell>
  );
}
