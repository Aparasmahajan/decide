"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { shuffle } from "@/lib/random";
import { cn } from "@/lib/cn";
import { Minus, Plus } from "lucide-react";

type TeamConfig = { members: string[]; teamCount: number };
const DEFAULT: TeamConfig = {
  members: ["Alice", "Bob", "Charlie", "Dana", "Eve", "Frank"],
  teamCount: 2,
};

const MIN_TEAMS = 2;
const MAX_TEAMS = 6;
/** How long "Shuffling…" holds before the new teams land. */
const SHUFFLE_MS = 600;

const TEAM_COLORS = [
  ["#f472b6", "#a855f7"],
  ["#38bdf8", "#22d3ee"],
  ["#22c55e", "#14b8a6"],
  ["#facc15", "#f97316"],
  ["#ef4444", "#f43f5e"],
  ["#8b5cf6", "#6366f1"],
];

/*
 * The `.glass` look without its `backdrop-filter`. These cards sit inside the
 * main panel, which already blurs the aurora behind it, so a second blur per
 * card re-sampled an already-blurred backdrop for no visible difference — six
 * extra full-card blurs, each re-run on every frame of the cards' entrance.
 */
const CARD =
  "overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_40px_-20px_rgba(0,0,0,0.45)]";

/** Team count from storage or the stepper, as a whole number in range. */
const clampTeams = (n: unknown) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(MAX_TEAMS, Math.max(MIN_TEAMS, v)) : MIN_TEAMS;
};

export default function TeamEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<TeamConfig>(DEFAULT);
  /* Raw textarea text; the member list is derived from it (see NameEngine). */
  const [draft, setDraft] = useState(DEFAULT.members.join("\n"));
  const [teams, setTeams] = useState<string[][]>([]);
  const [running, setRunning] = useState(false);
  /* Bumped per generation; keys each team's list so its entrance replays. */
  const [round, setRound] = useState(0);
  const reduce = useReducedMotion();

  const cfgRef = useRef(DEFAULT);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stored = readConfig<TeamConfig>(engine.slug, DEFAULT);
    const next = {
      members: parsePeople(lines(stored.members)).people,
      teamCount: clampTeams(stored.teamCount),
    };
    cfgRef.current = next;
    setCfg(next);
    setDraft(next.members.join("\n"));
  }, [engine.slug]);

  // Leaving mid-shuffle must not save teams nobody saw.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const persist = (patch: Partial<TeamConfig>) => {
    const next = { ...cfgRef.current, ...patch };
    cfgRef.current = next;
    setCfg(next);
    writeConfig(engine.slug, next);
  };

  const { dupes } = useMemo(() => parsePeople(draft), [draft]);

  /*
   * Never more teams than people: three people into four teams used to leave a
   * permanently "Empty" team in the result and the history.
   */
  const teamCount = Math.min(clampTeams(cfg.teamCount), Math.max(MIN_TEAMS, cfg.members.length));
  const canGenerate = cfg.members.length >= MIN_TEAMS;

  const generate = () => {
    if (timer.current || !canGenerate) return;
    // Split at click time, so what lands is exactly what was asked for.
    const { members } = cfgRef.current;
    const n = Math.min(clampTeams(cfgRef.current.teamCount), members.length);
    const buckets: string[][] = Array.from({ length: n }, () => []);
    /*
     * Dealt round-robin, so sizes differ by at most one. Which teams get the
     * extra player is shuffled too — otherwise Team 1 was always the big one.
     */
    const order = shuffle(Array.from({ length: n }, (_, i) => i));
    shuffle(members).forEach((name, i) => buckets[order[i % n]].push(name));
    setRunning(true);
    timer.current = setTimeout(
      () => {
        timer.current = null;
        setTeams(buckets);
        setRound((r) => r + 1);
        setRunning(false);
        pushHistory({
          engineId: engine.slug,
          outcome: buckets
            .map((b, i) => `Team ${i + 1}: ${b.join(", ")}`)
            .join(" | "),
        });
      },
      reduce ? 0 : SHUFFLE_MS,
    );
  };

  /*
   * While shuffling, the previous teams stay put and dim instead of being
   * cleared. Clearing them collapsed every card to "Empty" (and played the old
   * names' exit animations on top of the placeholder), then grew them back
   * 600ms later — the whole panel jumped twice per click. If the team count has
   * changed since, the old split no longer fits and the cards wait empty.
   */
  const fresh = teams.length === teamCount;
  const shown = fresh
    ? teams
    : Array.from({ length: teamCount }, (): string[] => []);

  return (
    <EngineShell
      engine={engine}
      variant="cool"
      side={
        <>
          <SidePanel title="Participants">
            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                persist({ members: parsePeople(e.target.value).people });
              }}
              readOnly={running}
              rows={8}
              placeholder="One name per line or CSV"
              aria-label="Participants"
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-white/25"
            />
            <div className="mt-2 text-[11px] text-white/40">
              {cfg.members.length} {cfg.members.length === 1 ? "person" : "people"}
              {dupes > 0 && ` · ${dupes} duplicate${dupes === 1 ? "" : "s"} ignored`}
            </div>
          </SidePanel>
          <SidePanel title="Number of teams">
            <div className="flex items-center gap-3">
              <button
                onClick={() => persist({ teamCount: clampTeams(teamCount - 1) })}
                disabled={running || teamCount <= MIN_TEAMS}
                aria-label="Fewer teams"
                className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white disabled:opacity-40"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="flex-1 rounded-xl bg-white/5 py-2 text-center text-xl font-semibold text-white ring-1 ring-white/10">
                {teamCount}
              </div>
              <button
                onClick={() => persist({ teamCount: clampTeams(teamCount + 1) })}
                disabled={
                  running ||
                  teamCount >= MAX_TEAMS ||
                  teamCount >= cfg.members.length
                }
                aria-label="More teams"
                className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {canGenerate && (
              <p className="mt-2 text-[11px] text-white/40">
                {cfg.members.length % teamCount === 0
                  ? `${cfg.members.length / teamCount} per team`
                  : `${Math.floor(cfg.members.length / teamCount)}–${Math.ceil(cfg.members.length / teamCount)} per team`}
              </p>
            )}
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          {cfg.members.length} {cfg.members.length === 1 ? "person" : "people"} →{" "}
          {teamCount} teams
        </p>
        <div className="grid w-full flex-1 place-items-center">
          {/*
           * Responsive columns instead of an inline `repeat(3, …)`: three
           * columns on a phone left each card ~85px wide, so names overflowed.
           */}
          <div
            className={cn(
              "grid w-full grid-cols-1 gap-4 transition-opacity duration-300",
              teamCount >= 2 && "sm:grid-cols-2",
              teamCount >= 3 && "lg:grid-cols-3",
              running && "opacity-40",
            )}
          >
            {shown.map((team, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={CARD}
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
                  <p className="text-2xl font-bold text-white">#{i + 1}</p>
                </div>
                {/*
                 * Keyed by round: a new generation mounts a fresh list whose rows
                 * stagger in; the old list simply goes. No AnimatePresence — the
                 * exit animations it ran were what doubled up with the placeholder.
                 */}
                <ul key={round} className="divide-y divide-white/5">
                  {team.map((m, j) => (
                    <motion.li
                      key={m}
                      initial={fresh && !reduce ? { x: -20, opacity: 0 } : false}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: Math.min(j * 0.05, 0.4) }}
                      className="px-4 py-2 text-sm text-white/90 [overflow-wrap:anywhere]"
                    >
                      {m}
                    </motion.li>
                  ))}
                  {team.length === 0 && (
                    <li className="px-4 py-6 text-center text-xs text-white/30">
                      {fresh ? "Empty" : "Waiting for players"}
                    </li>
                  )}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
        <BigActionButton
          label={
            running
              ? "Shuffling…"
              : canGenerate
                ? "Generate teams"
                : "Add at least 2 people"
          }
          onClick={generate}
          disabled={running || !canGenerate}
          color="#06b6d4"
          color2="#8b5cf6"
        />
      </div>
    </EngineShell>
  );
}

/** A stored list as textarea text, tolerating hand-edited storage that isn't an array. */
const lines = (v: unknown) =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string").join("\n") : "";

/**
 * One name per line or comma, trimmed, blanks dropped. Repeats are dropped
 * case-insensitively: two "Ana"s could land on different teams as if they were
 * two people, and shared one React key.
 */
function parsePeople(text: string): { people: string[]; dupes: number } {
  const seen = new Set<string>();
  const people: string[] = [];
  let dupes = 0;
  for (const raw of text.split(/[\n,]/)) {
    const name = raw.trim();
    if (!name) continue;
    const k = name.toLocaleLowerCase();
    if (seen.has(k)) {
      dupes++;
      continue;
    }
    seen.add(k);
    people.push(name);
  }
  return { people, dupes };
}
