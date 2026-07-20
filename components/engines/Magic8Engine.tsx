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

const ANSWERS = [
  { text: "It is certain.", tone: "yes" },
  { text: "Without a doubt.", tone: "yes" },
  { text: "Yes — definitely.", tone: "yes" },
  { text: "You may rely on it.", tone: "yes" },
  { text: "As I see it, yes.", tone: "yes" },
  { text: "Most likely.", tone: "yes" },
  { text: "Outlook good.", tone: "yes" },
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

export default function Magic8Engine({ engine }: { engine: EngineDef }) {
  const [question, setQuestion] = useState("");
  const [shaking, setShaking] = useState(false);
  const [answer, setAnswer] = useState<(typeof ANSWERS)[number] | null>(null);

  const shake = () => {
    if (shaking) return;
    setShaking(true);
    setAnswer(null);
    setTimeout(() => {
      const a = pick([...ANSWERS]);
      setAnswer(a);
      setShaking(false);
      pushHistory({
        engineId: engine.slug,
        outcome: `${question ? `“${question}” → ` : ""}${a.text}`,
      });
    }, 1600);
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
            <li>2. Shake the ball.</li>
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
            placeholder="Should I…?"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-lg text-white outline-none transition-colors focus:border-white/25 focus:bg-white/10"
          />
        </label>

        <div className="relative grid place-items-center">
          <motion.div
            animate={
              shaking
                ? { x: [0, -20, 20, -14, 14, -8, 8, 0], rotate: [0, -8, 8, -4, 4, 0] }
                : { x: 0, rotate: 0 }
            }
            transition={{ duration: 1.4 }}
            className="relative grid h-72 w-72 place-items-center rounded-full"
            style={{
              background:
                "radial-gradient(circle at 30% 25%, #1e40af 0%, #0b1e3f 50%, #020617 90%)",
              boxShadow:
                "inset 0 -30px 60px rgba(0,0,0,0.6), inset 0 10px 30px rgba(255,255,255,0.15), 0 40px 80px -20px rgba(0,0,0,0.7)",
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
                  <motion.div
                    key="shaking"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.3, 0.9, 0.3] }}
                    exit={{ opacity: 0 }}
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
