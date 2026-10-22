"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { shuffle } from "@/lib/random";
import { cn } from "@/lib/cn";

type PairConfig = { people: string[] };
const DEFAULT: PairConfig = {
  people: ["Ana", "Ben", "Cleo", "Dev", "Ela", "Finn"],
};

/** How long "Pairing…" holds before the new pairs land. */
const SHUFFLE_MS = 500;

/*
 * The `.glass` look without its `backdrop-filter`. These cards sit inside the
 * main panel, which already blurs what is behind it, and each one springs in on
 * scale — a per-card blur re-sampled on every frame of that, for no visible
 * difference over the panel's own blur.
 */
const CARD =
  "rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_40px_-20px_rgba(0,0,0,0.45)]";

export default function PairEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<PairConfig>(DEFAULT);
  /* Raw textarea text; the people list is derived from it (see NameEngine). */
  const [draft, setDraft] = useState(DEFAULT.people.join("\n"));
  const [pairs, setPairs] = useState<string[][]>([]);
  const [running, setRunning] = useState(false);
  /* Bumped per generation; keys the grid so the new pairs stagger in fresh. */
  const [round, setRound] = useState(0);
  const reduce = useReducedMotion();

  const cfgRef = useRef(DEFAULT);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stored = readConfig<PairConfig>(engine.slug, DEFAULT);
    const next = { people: parsePeople(lines(stored.people)).people };
    cfgRef.current = next;
    setCfg(next);
    setDraft(next.people.join("\n"));
  }, [engine.slug]);

  // Leaving mid-shuffle must not save pairs nobody saw.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const persist = (patch: Partial<PairConfig>) => {
    const next = { ...cfgRef.current, ...patch };
    cfgRef.current = next;
    setCfg(next);
    writeConfig(engine.slug, next);
  };

  const { dupes } = useMemo(() => parsePeople(draft), [draft]);
  const count = cfg.people.length;

  const generate = () => {
    if (timer.current || cfgRef.current.people.length < 2) return;
    // Paired at click time, so what lands is exactly what was asked for.
    const s = shuffle(cfgRef.current.people);
    const out: string[][] = [];
    for (let i = 0; i + 1 < s.length; i += 2) out.push([s[i], s[i + 1]]);
    /*
     * An odd one out joins the last pair as a trio. It used to be paired with a
     * literal "—", which read as a person and was saved to history that way.
     */
    if (s.length % 2 === 1) out[out.length - 1].push(s[s.length - 1]);
    setRunning(true);
    timer.current = setTimeout(
      () => {
        timer.current = null;
        setPairs(out);
        setRound((r) => r + 1);
        setRunning(false);
        pushHistory({
          engineId: engine.slug,
          outcome: out.map((p) => p.join(" & ")).join(" | "),
        });
      },
      reduce ? 0 : SHUFFLE_MS,
    );
  };

  return (
    <EngineShell
      engine={engine}
      variant="warm"
      side={
        <SidePanel title="People">
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              persist({ people: parsePeople(e.target.value).people });
            }}
            readOnly={running}
            rows={10}
            placeholder="One name per line or CSV"
            aria-label="People"
            className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-white/25"
          />
          <div className="mt-2 text-[11px] text-white/40">
            {count} {count === 1 ? "person" : "people"}
            {count >= 3 && count % 2 === 1 && " · odd one out joins a trio"}
            {dupes > 0 && ` · ${dupes} duplicate${dupes === 1 ? "" : "s"} ignored`}
          </div>
        </SidePanel>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          Pairing {count} {count === 1 ? "person" : "people"}
        </p>
        <div className="grid w-full flex-1 place-items-center">
          {/*
           * The previous pairs stay up, dimmed, while the next set is drawn.
           * Clearing them collapsed the grid to nothing and grew it back 500ms
           * later, so everything below jumped twice per click.
           */}
          <div
            key={round}
            className={cn(
              "grid w-full max-w-2xl grid-cols-1 gap-3 transition-opacity duration-300 sm:grid-cols-2",
              running && "opacity-40",
            )}
          >
            {pairs.map((p, i) => (
              <motion.div
                key={p.join("\u0000")}
                initial={reduce ? false : { opacity: 0, scale: 0.9, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                // Capped so a class of 30 doesn't take two seconds to finish landing.
                transition={{ delay: Math.min(i * 0.08, 0.6), type: "spring" }}
                className={cn(
                  CARD,
                  "flex items-center justify-between gap-3 px-4 py-3",
                  p.length === 3 && "sm:col-span-2",
                )}
              >
                {p.map((name, j) => (
                  <Fragment key={name}>
                    {j > 0 && (
                      <span
                        aria-hidden
                        className="shrink-0 text-xl"
                        style={{
                          background: "linear-gradient(135deg,#f472b6,#f97316)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                        }}
                      >
                        ✦
                      </span>
                    )}
                    <span className="min-w-0 text-lg font-semibold text-white [overflow-wrap:anywhere]">
                      {name}
                    </span>
                  </Fragment>
                ))}
              </motion.div>
            ))}
          </div>
        </div>
        <BigActionButton
          label={
            running
              ? "Pairing…"
              : count < 2
                ? "Add at least 2 people"
                : pairs.length
                  ? "Shuffle again"
                  : "Generate pairs"
          }
          onClick={generate}
          disabled={running || count < 2}
          color="#f472b6"
          color2="#f97316"
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
 * case-insensitively —a duplicate could be paired with itself ("Ana & Ana").
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
