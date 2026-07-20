"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { shuffle } from "@/lib/random";

type PairConfig = { people: string[] };
const DEFAULT: PairConfig = {
  people: ["Ana", "Ben", "Cleo", "Dev", "Ela", "Finn"],
};

export default function PairEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<PairConfig>(DEFAULT);
  const [pairs, setPairs] = useState<string[][]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setCfg(readConfig<PairConfig>(engine.slug, DEFAULT));
  }, [engine.slug]);

  const persist = (patch: Partial<PairConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  const generate = () => {
    if (running || cfg.people.length < 2) return;
    setRunning(true);
    setPairs([]);
    setTimeout(() => {
      const s = shuffle(cfg.people);
      const out: string[][] = [];
      for (let i = 0; i < s.length; i += 2) {
        out.push([s[i], s[i + 1] ?? "—"]);
      }
      setPairs(out);
      setRunning(false);
      pushHistory({
        engineId: engine.slug,
        outcome: out.map((p) => p.join(" & ")).join(" | "),
      });
    }, 500);
  };

  return (
    <EngineShell
      engine={engine}
      variant="warm"
      side={
        <SidePanel title="People">
          <textarea
            value={cfg.people.join("\n")}
            onChange={(e) =>
              persist({
                people: e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            rows={10}
            className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-white/25"
          />
        </SidePanel>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          Pairing {cfg.people.length} people
        </p>
        <div className="grid w-full flex-1 place-items-center">
          <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
            <AnimatePresence>
              {pairs.map((p, i) => (
                <motion.div
                  key={p.join("-") + i}
                  initial={{ opacity: 0, scale: 0.9, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: i * 0.08, type: "spring" }}
                  className="glass flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
                >
                  <span className="text-lg font-semibold text-white">
                    {p[0]}
                  </span>
                  <span
                    className="text-xl"
                    style={{
                      background:
                        "linear-gradient(135deg,#f472b6,#f97316)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    ✦
                  </span>
                  <span className="text-lg font-semibold text-white">
                    {p[1]}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
        <BigActionButton
          label={running ? "Pairing…" : "Generate pairs"}
          onClick={generate}
          disabled={running || cfg.people.length < 2}
          color="#f472b6"
          color2="#f97316"
        />
      </div>
    </EngineShell>
  );
}
