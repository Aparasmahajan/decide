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
import { Minus, Plus } from "lucide-react";

type TeamConfig = { members: string[]; teamCount: number };
const DEFAULT: TeamConfig = {
  members: ["Alice", "Bob", "Charlie", "Dana", "Eve", "Frank"],
  teamCount: 2,
};

const TEAM_COLORS = [
  ["#f472b6", "#a855f7"],
  ["#38bdf8", "#22d3ee"],
  ["#22c55e", "#14b8a6"],
  ["#facc15", "#f97316"],
  ["#ef4444", "#f43f5e"],
  ["#8b5cf6", "#6366f1"],
];

export default function TeamEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<TeamConfig>(DEFAULT);
  const [teams, setTeams] = useState<string[][]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setCfg(readConfig<TeamConfig>(engine.slug, DEFAULT));
  }, [engine.slug]);

  const persist = (patch: Partial<TeamConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  const generate = () => {
    if (running || cfg.members.length === 0) return;
    setRunning(true);
    setTeams([]);
    setTimeout(() => {
      const shuffled = shuffle(cfg.members);
      const buckets: string[][] = Array.from(
        { length: cfg.teamCount },
        () => [],
      );
      shuffled.forEach((name, i) => {
        buckets[i % cfg.teamCount].push(name);
      });
      setTeams(buckets);
      setRunning(false);
      pushHistory({
        engineId: engine.slug,
        outcome: buckets
          .map((b, i) => `Team ${i + 1}: ${b.join(", ")}`)
          .join(" | "),
      });
    }, 600);
  };

  return (
    <EngineShell
      engine={engine}
      variant="cool"
      side={
        <>
          <SidePanel title="Participants">
            <textarea
              value={cfg.members.join("\n")}
              onChange={(e) =>
                persist({
                  members: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              rows={8}
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-white/25"
            />
            <div className="mt-2 text-[11px] text-white/40">
              {cfg.members.length} people
            </div>
          </SidePanel>
          <SidePanel title="Number of teams">
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  persist({ teamCount: Math.max(2, cfg.teamCount - 1) })
                }
                className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="flex-1 rounded-xl bg-white/5 py-2 text-center text-xl font-semibold text-white ring-1 ring-white/10">
                {cfg.teamCount}
              </div>
              <button
                onClick={() =>
                  persist({
                    teamCount: Math.min(6, cfg.teamCount + 1),
                  })
                }
                className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          {cfg.members.length} people → {cfg.teamCount} teams
        </p>
        <div className="grid w-full flex-1 place-items-center">
          <div
            className="grid w-full gap-4"
            style={{
              gridTemplateColumns: `repeat(${Math.min(teams.length || cfg.teamCount, 3)}, minmax(0, 1fr))`,
            }}
          >
            {(teams.length ? teams : Array.from({ length: cfg.teamCount }, () => [])).map(
              (team, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="glass overflow-hidden rounded-2xl"
                >
                  <div
                    className="px-4 py-3"
                    style={{
                      background: `linear-gradient(90deg, ${TEAM_COLORS[i % TEAM_COLORS.length][0]}55, ${TEAM_COLORS[i % TEAM_COLORS.length][1]}55)`,
                    }}
                  >
                    <p className="text-xs uppercase tracking-widest text-white/70">
                      Team
                    </p>
                    <p className="text-2xl font-bold text-white">
                      #{i + 1}
                    </p>
                  </div>
                  <ul className="divide-y divide-white/5">
                    <AnimatePresence>
                      {team.map((m, j) => (
                        <motion.li
                          key={m}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: j * 0.05 }}
                          className="px-4 py-2 text-sm text-white/90"
                        >
                          {m}
                        </motion.li>
                      ))}
                    </AnimatePresence>
                    {team.length === 0 && (
                      <li className="px-4 py-6 text-center text-xs text-white/30">
                        Empty
                      </li>
                    )}
                  </ul>
                </motion.div>
              ),
            )}
          </div>
        </div>
        <BigActionButton
          label={running ? "Shuffling…" : "Generate teams"}
          onClick={generate}
          disabled={running || cfg.members.length === 0}
          color="#06b6d4"
          color2="#8b5cf6"
        />
      </div>
    </EngineShell>
  );
}
