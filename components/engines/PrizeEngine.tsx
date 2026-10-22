"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { pickWeighted } from "@/lib/random";
import { Minus, Plus } from "lucide-react";

/*
 * Each prize carries a stable id. Rows used to be keyed by index, so deleting
 * one shifted every row below it onto a different DOM node, and "remove after
 * draw" matched by label, which took out every prize sharing that label.
 */
type Prize = { id: string; label: string; weight: number };
/** `drawn` holds prizes taken out by "remove after draw", so they can be put back. */
type PrizeConfig = { prizes: Prize[]; removeAfter: boolean; drawn: Prize[] };
const DEFAULT: PrizeConfig = {
  // Fixed ids: this is also the server-rendered initial state.
  prizes: [
    { id: "grand", label: "🥇 Grand Prize", weight: 1 },
    { id: "runner-up", label: "🥈 Runner-up", weight: 3 },
    { id: "third", label: "🥉 Third Place", weight: 5 },
    { id: "consolation", label: "🎟 Consolation", weight: 10 },
  ],
  removeAfter: false,
  drawn: [],
};

/** How long the box shakes before it opens — the shake and the reveal share it. */
const OPEN_MS = 1100;
const MAX_WEIGHT = 9999;

const uid = () => Math.random().toString(36).slice(2, 10);

/** Odds are never negative, NaN or Infinity (`1e999` used to store `null`). */
const cleanWeight = (w: unknown) => {
  const n = Number(w);
  return Number.isNaN(n) ? 0 : Math.min(MAX_WEIGHT, Math.max(0, n));
};

const normalize = (list: unknown): Prize[] =>
  (Array.isArray(list) ? (list as Partial<Prize>[]) : [])
    .filter((p) => p && typeof p === "object")
    .map((p) => ({
    id: p.id || uid(),
    label: String(p.label ?? ""),
    weight: cleanWeight(p.weight),
  }));

export default function PrizeEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<PrizeConfig>(DEFAULT);
  const [winner, setWinner] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState(false);
  /*
   * Raw text of an odds field while it is being edited, so it can be cleared
   * and retyped. Writing the parsed number straight back turned an emptied
   * field into "0" under the caret, and the next digit typed made "05".
   */
  const [weightDraft, setWeightDraft] = useState<Record<string, string>>({});
  const reduce = useReducedMotion();

  /* Latest config, for the reveal that runs OPEN_MS after the click. */
  const cfgRef = useRef(DEFAULT);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stored = readConfig<PrizeConfig>(engine.slug, DEFAULT);
    const next = {
      ...stored,
      prizes: normalize(stored.prizes),
      drawn: normalize(stored.drawn),
    };
    cfgRef.current = next;
    setCfg(next);
  }, [engine.slug]);

  // Leaving mid-shake must not reveal, or save, a prize nobody saw.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const save = (next: PrizeConfig) => {
    cfgRef.current = next;
    setCfg(next);
    writeConfig(engine.slug, next);
  };
  const persist = (patch: Partial<PrizeConfig>) =>
    save({ ...cfgRef.current, ...patch });

  /* Only prizes that can actually come out of the box. */
  const drawable = cfg.prizes.filter((p) => p.weight > 0 && p.label.trim());
  const totalWeight = drawable.reduce((s, p) => s + p.weight, 0);

  const draw = () => {
    const pool = cfgRef.current.prizes.filter(
      (p) => p.weight > 0 && p.label.trim(),
    );
    if (timer.current || pool.length === 0) return;
    /*
     * Drawn at click time, revealed after the shake. Previously it was drawn
     * inside the timeout from the click's (stale) config, and an all-zero odds
     * list fell through to a uniform pick — so a prize set to 0 could still win.
     */
    const prize = pickWeighted(pool.map((p) => ({ value: p, weight: p.weight })));
    setOpening(true);
    setOpened(false);
    setWinner(null);
    timer.current = setTimeout(
      () => {
        timer.current = null;
        const label = prize.label.trim();
        setWinner(label);
        setOpening(false);
        setOpened(true);
        pushHistory({ engineId: engine.slug, outcome: label });
        const c = cfgRef.current;
        if (c.removeAfter) {
          save({
            ...c,
            prizes: c.prizes.filter((p) => p.id !== prize.id),
            drawn: [...c.drawn, prize],
          });
        }
      },
      reduce ? 0 : OPEN_MS,
    );
  };

  const restore = () => {
    const c = cfgRef.current;
    save({ ...c, prizes: [...c.prizes, ...c.drawn], drawn: [] });
  };

  const updatePrize = (id: string, patch: Partial<Prize>) => {
    persist({
      prizes: cfgRef.current.prizes.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    });
  };

  const editWeight = (id: string, raw: string) => {
    setWeightDraft((d) => ({ ...d, [id]: raw }));
    updatePrize(id, { weight: cleanWeight(raw === "" ? 0 : raw) });
  };

  const endWeightEdit = (id: string) =>
    setWeightDraft(({ [id]: _, ...rest }) => rest);

  const nudgeWeight = (id: string, delta: number) => {
    const p = cfgRef.current.prizes.find((x) => x.id === id);
    if (!p) return;
    endWeightEdit(id);
    updatePrize(id, { weight: cleanWeight(Math.round(p.weight) + delta) });
  };

  const exhausted = cfg.prizes.length === 0 && cfg.drawn.length > 0;
  const lead = winner ? splitLead(winner) : null;

  return (
    <EngineShell
      engine={engine}
      variant="warm"
      side={
        <>
          <SidePanel title="Prizes & odds">
            {/*
              The odds field used to be an unlabelled number box beside the
              name, which read as a quantity — people didn't realise it was
              where odds are set. Column headings, −/+ steppers and the hint
              right under the list make it explicit.
            */}
            {cfg.prizes.length > 0 && (
              <div className="mb-2 flex items-center gap-2 px-0.5 text-[10px] uppercase tracking-widest text-white/40">
                <span className="flex-1">Prize</span>
                <span className="w-[88px] text-center">Odds</span>
                <span className="w-9 text-right">Chance</span>
                <span className="w-7" />
              </div>
            )}
            <div className="space-y-2">
              {cfg.prizes.map((p) => {
                const live = p.weight > 0 && p.label.trim();
                const name = p.label || "prize";
                return (
                  <div key={p.id} className="flex items-center gap-2">
                    <input
                      value={p.label}
                      onChange={(e) => updatePrize(p.id, { label: e.target.value })}
                      placeholder="Prize name"
                      aria-label="Prize name"
                      className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white outline-none focus:border-white/25"
                    />
                    <div className="flex w-[88px] shrink-0 items-center overflow-hidden rounded-lg border border-white/10 bg-white/5 focus-within:border-white/25">
                      <button
                        type="button"
                        onClick={() => nudgeWeight(p.id, -1)}
                        disabled={opening || p.weight <= 0}
                        aria-label={`Lower odds for ${name}`}
                        className="grid h-8 w-6 shrink-0 place-items-center text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-30"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={MAX_WEIGHT}
                        step="any"
                        value={weightDraft[p.id] ?? String(p.weight)}
                        onChange={(e) => editWeight(p.id, e.target.value)}
                        onBlur={() => endWeightEdit(p.id)}
                        onFocus={(e) => e.target.select()}
                        className="h-8 w-full min-w-0 bg-transparent text-center text-sm tabular-nums text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        title="Odds — higher is drawn more often"
                        aria-label={`Odds for ${name}`}
                      />
                      <button
                        type="button"
                        onClick={() => nudgeWeight(p.id, 1)}
                        disabled={opening || p.weight >= MAX_WEIGHT}
                        aria-label={`Raise odds for ${name}`}
                        className="grid h-8 w-6 shrink-0 place-items-center text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-30"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span
                      className="w-9 shrink-0 text-right text-[11px] tabular-nums text-white/40"
                      title="Chance of this prize on the next draw"
                    >
                      {live && totalWeight > 0
                        ? `${Math.round((p.weight / totalWeight) * 100)}%`
                        : "—"}
                    </span>
                    <button
                      onClick={() =>
                        persist({
                          prizes: cfgRef.current.prizes.filter((x) => x.id !== p.id),
                        })
                      }
                      disabled={opening}
                      aria-label={`Remove ${p.label || "prize"}`}
                      className="w-7 shrink-0 rounded-lg py-1.5 text-sm text-white/40 hover:bg-white/5 hover:text-white/80 disabled:opacity-40"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() =>
                persist({
                  prizes: [
                    ...cfgRef.current.prizes,
                    { id: uid(), label: "New prize", weight: 1 },
                  ],
                })
              }
              className="mt-3 w-full rounded-lg border border-dashed border-white/15 py-2 text-sm text-white/60 hover:border-white/30 hover:text-white/90"
            >
              + Add prize
            </button>
            <p className="mt-3 text-[11px] text-white/40">
              Higher odds are drawn more often — a prize with odds 4 comes up
              twice as often as one with 2. Odds of 0 are never drawn.
            </p>
          </SidePanel>
          <SidePanel title="Modes">
            <label className="flex items-center justify-between text-sm text-white/80">
              <span>Remove after draw</span>
              <input
                type="checkbox"
                checked={cfg.removeAfter}
                onChange={(e) => persist({ removeAfter: e.target.checked })}
                className="h-4 w-4 accent-rose-400"
              />
            </label>
            {cfg.drawn.length > 0 && (
              <button
                onClick={restore}
                disabled={opening}
                className="mt-3 w-full rounded-lg border border-dashed border-white/15 py-2 text-sm text-white/60 hover:border-white/30 hover:text-white/90 disabled:opacity-50"
              >
                Put back {cfg.drawn.length} drawn
              </button>
            )}
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          {exhausted ? "Every prize drawn" : "Draw the lucky one"}
        </p>
        <div
          className="relative grid min-h-[220px] w-full flex-1 place-items-center"
          aria-live="polite"
        >
          <AnimatePresence mode="wait">
            {!opened ? (
              <motion.div
                key="box"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  y: opening && !reduce ? [0, -14, 0, -8, 0] : 0,
                  rotate: opening && !reduce ? [0, -6, 6, -4, 4, 0] : 0,
                }}
                exit={{ scale: 0.4, opacity: 0 }}
                /*
                 * The shake runs for exactly OPEN_MS, the same constant the reveal
                 * waits on. It used to shake for 0.9s against a 1.1s timer, so the
                 * box sat dead still for a beat before popping. Scale and opacity
                 * keep their own short timing so "Draw again" fades the box in
                 * quickly while it is already shaking.
                 */
                transition={{
                  duration: opening ? OPEN_MS / 1000 : 0.4,
                  scale: { duration: 0.4 },
                  opacity: { duration: 0.4 },
                }}
                aria-hidden
                className="text-[160px] leading-none drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)] sm:text-[200px]"
              >
                🎁
              </motion.div>
            ) : (
              <motion.div
                key="winner"
                initial={{ opacity: 0, y: 24, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 18 }}
                className="text-center"
              >
                <div className="mb-3 text-6xl" aria-hidden>
                  🎉
                </div>
                {/*
                 * Leading emoji sit outside the gradient: `text-gradient-warm`
                 * clips a background to the glyphs with a transparent fill, so
                 * "🥇" rendered as a flat gradient blob instead of a medal.
                 */}
                <p className="max-w-lg px-6 text-4xl font-black tracking-tight [overflow-wrap:anywhere] sm:text-5xl">
                  {lead?.lead && <span className="mr-3">{lead.lead}</span>}
                  <span className="text-gradient-warm">{lead?.rest}</span>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {exhausted && !opening ? (
          <BigActionButton
            label={cfg.drawn.length === 1 ? "Put it back" : `Put all ${cfg.drawn.length} back`}
            onClick={restore}
            color="#f43f5e"
            color2="#f59e0b"
          />
        ) : (
          <BigActionButton
            label={
              opening
                ? "Opening…"
                : drawable.length === 0
                  ? cfg.prizes.length === 0
                    ? "Add a prize"
                    : "Give a prize odds above 0"
                  : opened
                    ? "Draw again"
                    : "Draw a prize"
            }
            onClick={draw}
            disabled={opening || drawable.length === 0}
            color="#f43f5e"
            color2="#f59e0b"
          />
        )}
      </div>
    </EngineShell>
  );
}

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

const PICTO = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u;

/** Splits "🥇 Grand Prize" into its leading emoji and the text after it. */
function splitLead(s: string) {
  const g = segmenter
    ? Array.from(segmenter.segment(s), (x) => x.segment)
    : Array.from(s);
  let i = 0;
  while (i < g.length && (PICTO.test(g[i]) || !g[i].trim())) i++;
  return { lead: g.slice(0, i).join("").trim(), rest: g.slice(i).join("").trim() };
}
