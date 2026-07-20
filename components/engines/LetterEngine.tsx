"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { pick } from "@/lib/random";

type Alphabet = "en" | "vowels" | "consonants" | "custom";
type LetterConfig = { alphabet: Alphabet; custom: string; uppercase: boolean };
const DEFAULT: LetterConfig = {
  alphabet: "en",
  custom: "ABCDEFG",
  uppercase: true,
};

const SETS: Record<Alphabet, string> = {
  en: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  vowels: "AEIOU",
  consonants: "BCDFGHJKLMNPQRSTVWXYZ",
  custom: "",
};

export default function LetterEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<LetterConfig>(DEFAULT);
  const [letter, setLetter] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    setCfg(readConfig<LetterConfig>(engine.slug, DEFAULT));
  }, [engine.slug]);

  const persist = (patch: Partial<LetterConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  const set =
    cfg.alphabet === "custom"
      ? cfg.custom.split("").filter((c) => c.trim())
      : SETS[cfg.alphabet].split("");

  const spin = () => {
    if (rolling || set.length === 0) return;
    setRolling(true);
    let n = 0;
    const iv = setInterval(() => {
      setLetter(pick(set));
      n++;
      if (n > 14) {
        clearInterval(iv);
        const finalLetter = pick(set);
        const l = cfg.uppercase
          ? finalLetter.toUpperCase()
          : finalLetter.toLowerCase();
        setLetter(l);
        setRolling(false);
        pushHistory({ engineId: engine.slug, outcome: l });
      }
    }, 60);
  };

  return (
    <EngineShell
      engine={engine}
      variant="warm"
      side={
        <>
          <SidePanel title="Alphabet">
            <div className="grid grid-cols-2 gap-2">
              {(["en", "vowels", "consonants", "custom"] as Alphabet[]).map(
                (a) => (
                  <button
                    key={a}
                    onClick={() => persist({ alphabet: a })}
                    className={
                      "rounded-xl px-3 py-2 text-sm capitalize transition-all " +
                      (cfg.alphabet === a
                        ? "bg-white text-ink-950 shadow-glow"
                        : "bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white")
                    }
                  >
                    {a}
                  </button>
                ),
              )}
            </div>
            {cfg.alphabet === "custom" && (
              <input
                value={cfg.custom}
                onChange={(e) => persist({ custom: e.target.value })}
                className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-mono text-white outline-none focus:border-white/25"
              />
            )}
          </SidePanel>
          <SidePanel title="Case">
            <label className="flex items-center justify-between text-sm text-white/80">
              <span>Uppercase</span>
              <input
                type="checkbox"
                checked={cfg.uppercase}
                onChange={(e) => persist({ uppercase: e.target.checked })}
                className="h-4 w-4 accent-fuchsia-400"
              />
            </label>
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-10">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          Random letter
        </p>
        <div className="grid flex-1 place-items-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={letter ?? "empty"}
              initial={{ y: 40, opacity: 0, rotateX: 90 }}
              animate={{ y: 0, opacity: 1, rotateX: 0 }}
              exit={{ y: -40, opacity: 0, rotateX: -90 }}
              transition={{ type: "spring", stiffness: 220, damping: 18 }}
              className="text-[280px] font-black leading-none tracking-tighter text-gradient"
            >
              {letter ?? "?"}
            </motion.div>
          </AnimatePresence>
        </div>
        <BigActionButton
          label={rolling ? "Choosing…" : "Pick a letter"}
          onClick={spin}
          disabled={rolling}
          color="#f43f5e"
          color2="#8b5cf6"
        />
      </div>
    </EngineShell>
  );
}
