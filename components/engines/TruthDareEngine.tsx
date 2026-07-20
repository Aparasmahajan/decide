"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import EngineShell, { SidePanel } from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { pick } from "@/lib/random";

type TDConfig = { truths: string[]; dares: string[] };
const DEFAULT: TDConfig = {
  truths: [
    "What's a secret you've never told anyone here?",
    "What's your most embarrassing memory?",
    "Who in this room would you swap lives with?",
    "What's the last lie you told?",
    "What's a fear you rarely admit?",
    "What's your biggest guilty pleasure?",
    "Who was your first crush?",
    "What's the most childish thing you still do?",
  ],
  dares: [
    "Do your best impression of someone in the room.",
    "Talk in an accent for the next 3 rounds.",
    "Text the 5th person in your contacts 'hi 👀'.",
    "Do 10 jumping jacks right now.",
    "Let someone post a status as you.",
    "Sing the chorus of the last song you heard.",
    "Do a dramatic runway walk across the room.",
    "Speak only in questions until your next turn.",
  ],
};

type Kind = "truth" | "dare";

export default function TruthDareEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<TDConfig>(DEFAULT);
  const [kind, setKind] = useState<Kind | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);

  useEffect(() => {
    setCfg(readConfig<TDConfig>(engine.slug, DEFAULT));
  }, [engine.slug]);

  const persist = (patch: Partial<TDConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  const reveal = (k: Kind) => {
    const pool = k === "truth" ? cfg.truths : cfg.dares;
    if (pool.length === 0) return;
    const p = pick(pool);
    setKind(k);
    setPrompt(p);
    pushHistory({
      engineId: engine.slug,
      outcome: `${k === "truth" ? "Truth" : "Dare"}: ${p}`,
    });
  };

  const surprise = () => reveal(Math.random() < 0.5 ? "truth" : "dare");

  const accent = kind === "dare" ? "#ec4899" : "#8b5cf6";

  return (
    <EngineShell
      engine={engine}
      variant="aurora"
      side={
        <>
          <SidePanel title="Truths">
            <textarea
              value={cfg.truths.join("\n")}
              onChange={(e) =>
                persist({
                  truths: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              rows={6}
              placeholder="One truth question per line"
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-white/25"
            />
            <div className="mt-2 text-[11px] text-white/40">
              {cfg.truths.length} truths
            </div>
          </SidePanel>
          <SidePanel title="Dares">
            <textarea
              value={cfg.dares.join("\n")}
              onChange={(e) =>
                persist({
                  dares: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              rows={6}
              placeholder="One dare per line"
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-white/25"
            />
            <div className="mt-2 text-[11px] text-white/40">
              {cfg.dares.length} dares
            </div>
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          Truth or dare?
        </p>
        <div className="grid flex-1 w-full place-items-center">
          <AnimatePresence mode="wait">
            {prompt ? (
              <motion.div
                key={prompt}
                initial={{ opacity: 0, y: 24, rotateX: 60 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                exit={{ opacity: 0, y: -24, rotateX: -60 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="max-w-lg text-center"
                style={{ perspective: 800 }}
              >
                <span
                  className="mb-4 inline-block rounded-full px-4 py-1 text-xs font-bold uppercase tracking-widest text-white"
                  style={{ background: accent }}
                >
                  {kind}
                </span>
                <p className="px-4 text-3xl font-bold leading-snug text-white sm:text-4xl">
                  {prompt}
                </p>
              </motion.div>
            ) : (
              <motion.p
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                className="text-2xl font-medium text-white/50"
              >
                Choose your fate.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <motion.button
            onClick={() => reveal("truth")}
            whileHover={{ y: -2, scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            disabled={cfg.truths.length === 0}
            className="rounded-2xl px-7 py-4 text-base font-semibold text-white disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg,#8b5cf6,#6366f1)",
              boxShadow: "0 12px 30px -8px #8b5cf688",
            }}
          >
            Truth
          </motion.button>
          <motion.button
            onClick={() => reveal("dare")}
            whileHover={{ y: -2, scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            disabled={cfg.dares.length === 0}
            className="rounded-2xl px-7 py-4 text-base font-semibold text-white disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg,#ec4899,#f43f5e)",
              boxShadow: "0 12px 30px -8px #ec489988",
            }}
          >
            Dare
          </motion.button>
          <motion.button
            onClick={surprise}
            whileHover={{ y: -2, scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            className="rounded-2xl border border-white/15 bg-white/5 px-7 py-4 text-base font-semibold text-white/80 hover:bg-white/10"
          >
            🎲 Surprise me
          </motion.button>
        </div>
      </div>
    </EngineShell>
  );
}
