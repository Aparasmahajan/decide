"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { pick } from "@/lib/random";

type FlipConfig = { pages: string[] };
const DEFAULT: FlipConfig = {
  pages: [
    "Go for it.",
    "Wait a day.",
    "Ask a friend.",
    "Sleep on it.",
    "Trust your gut.",
    "Flip a coin.",
    "Do the opposite.",
    "Start small.",
  ],
};

export default function FlipBookEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<FlipConfig>(DEFAULT);
  const [page, setPage] = useState<string | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [flipKey, setFlipKey] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    setCfg(readConfig<FlipConfig>(engine.slug, DEFAULT));
    return () => timers.current.forEach(clearTimeout);
  }, [engine.slug]);

  const persist = (patch: Partial<FlipConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  const flip = () => {
    if (flipping || cfg.pages.length === 0) return;
    setFlipping(true);
    timers.current.forEach(clearTimeout);
    timers.current = [];

    const flips = 6;
    for (let i = 0; i < flips; i++) {
      timers.current.push(
        setTimeout(() => {
          setPage(pick(cfg.pages));
          setFlipKey((k) => k + 1);
        }, i * 180),
      );
    }
    timers.current.push(
      setTimeout(() => {
        const final = pick(cfg.pages);
        setPage(final);
        setFlipKey((k) => k + 1);
        setFlipping(false);
        pushHistory({ engineId: engine.slug, outcome: final });
      }, flips * 180),
    );
  };

  return (
    <EngineShell
      engine={engine}
      variant="warm"
      side={
        <SidePanel title="Pages">
          <textarea
            value={cfg.pages.join("\n")}
            onChange={(e) =>
              persist({
                pages: e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            rows={10}
            placeholder="One page per line"
            className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-white/25"
          />
          <div className="mt-2 text-[11px] text-white/40">
            {cfg.pages.length} pages in the book
          </div>
        </SidePanel>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          Flip through possibilities
        </p>
        <div
          className="grid flex-1 w-full place-items-center"
          style={{ perspective: 1200 }}
        >
          <div
            className="relative flex h-72 w-64 items-center justify-center rounded-r-2xl rounded-l-md text-center shadow-2xl"
            style={{
              background:
                "linear-gradient(135deg,#fff7ed,#ffedd5)",
              boxShadow:
                "0 30px 60px -20px rgba(0,0,0,0.6), inset 8px 0 20px -8px rgba(0,0,0,0.25)",
              transformStyle: "preserve-3d",
            }}
          >
            {/* spine */}
            <div
              className="absolute inset-y-0 left-0 w-3 rounded-l-md"
              style={{ background: "linear-gradient(90deg,#c2410c,#f97316)" }}
            />
            <AnimatePresence mode="popLayout">
              <motion.p
                key={flipKey}
                initial={{ rotateY: -90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: 90, opacity: 0 }}
                transition={{ duration: 0.18 }}
                style={{
                  transformOrigin: "left center",
                  backfaceVisibility: "hidden",
                }}
                className="px-8 text-2xl font-bold leading-snug text-slate-800"
              >
                {page ?? "Open the book"}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
        <BigActionButton
          label={flipping ? "Flipping…" : "Flip the book"}
          onClick={flip}
          disabled={flipping || cfg.pages.length === 0}
          color="#f97316"
          color2="#f472b6"
        />
      </div>
    </EngineShell>
  );
}
