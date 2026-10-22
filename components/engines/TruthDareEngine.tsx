"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import EngineShell, { SidePanel } from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { shuffle } from "@/lib/random";

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

/*
 * Clicks closer together than this are ignored. The card swap is a spring exit
 * followed by a spring entrance under `mode="wait"`; mashing the buttons queued
 * up prompts that were saved to history but replaced before they ever settled
 * on screen.
 */
const REVEAL_MS = 450;

export default function TruthDareEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<TDConfig>(DEFAULT);
  /*
   * Raw textarea text per list; the prompt lists are derived from it. Binding
   * the textareas to `list.join("\n")` re-trimmed every line per keystroke, so
   * the space after each word vanished as you typed it — whole questions could
   * not be written — and Enter at the end did nothing.
   */
  const [drafts, setDrafts] = useState({
    truths: DEFAULT.truths.join("\n"),
    dares: DEFAULT.dares.join("\n"),
  });
  const [kind, setKind] = useState<Kind | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  /* Bumped per draw, so the card animates even when the text is unchanged. */
  const [round, setRound] = useState(0);

  const cfgRef = useRef(DEFAULT);
  const lastAt = useRef(0);
  /*
   * A shuffled deck per kind, dealt from the end: nothing repeats until every
   * prompt has come up once. With a plain random pick, 1 in 8 draws repeated the
   * prompt already on screen — and since the card was keyed by its text, that
   * looked like the button doing nothing.
   */
  const decks = useRef<Record<Kind, string[]>>({ truth: [], dare: [] });

  useEffect(() => {
    const stored = readConfig<TDConfig>(engine.slug, DEFAULT);
    const next = {
      truths: parseLines(lines(stored.truths)),
      dares: parseLines(lines(stored.dares)),
    };
    cfgRef.current = next;
    setCfg(next);
    setDrafts({ truths: next.truths.join("\n"), dares: next.dares.join("\n") });
  }, [engine.slug]);

  const edit = (list: keyof TDConfig, text: string) => {
    setDrafts((d) => ({ ...d, [list]: text }));
    const next = { ...cfgRef.current, [list]: parseLines(text) };
    cfgRef.current = next;
    setCfg(next);
    writeConfig(engine.slug, next);
  };

  const deal = (k: Kind, pool: string[]) => {
    // Drop cards whose prompt was edited away since the deck was shuffled.
    let deck = decks.current[k].filter((p) => pool.includes(p));
    if (deck.length === 0) {
      deck = shuffle(pool);
      // Never open a fresh deck with the prompt that is on screen right now.
      const top = deck.length - 1;
      if (deck.length > 1 && deck[top] === prompt) {
        [deck[0], deck[top]] = [deck[top], deck[0]];
      }
    }
    const card = deck.pop()!;
    decks.current[k] = deck;
    return card;
  };

  const reveal = (k: Kind) => {
    const c = cfgRef.current;
    const pool = k === "truth" ? c.truths : c.dares;
    const now = performance.now();
    if (pool.length === 0 || now - lastAt.current < REVEAL_MS) return;
    lastAt.current = now;
    const p = deal(k, pool);
    setKind(k);
    setPrompt(p);
    setRound((r) => r + 1);
    pushHistory({
      engineId: engine.slug,
      outcome: `${k === "truth" ? "Truth" : "Dare"}: ${p}`,
    });
  };

  // Falls back to whichever list has prompts, instead of silently doing
  // nothing half the time when one of them is empty.
  const surprise = () => {
    const { truths, dares } = cfgRef.current;
    if (!truths.length) return reveal("dare");
    if (!dares.length) return reveal("truth");
    reveal(Math.random() < 0.5 ? "truth" : "dare");
  };

  const accent = kind === "dare" ? "#ec4899" : "#8b5cf6";
  const nothing = cfg.truths.length === 0 && cfg.dares.length === 0;

  return (
    <EngineShell
      engine={engine}
      variant="aurora"
      side={
        <>
          <SidePanel title="Truths">
            <textarea
              value={drafts.truths}
              onChange={(e) => edit("truths", e.target.value)}
              rows={6}
              placeholder="One truth question per line"
              aria-label="Truth questions"
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-white/25"
            />
            <div className="mt-2 text-[11px] text-white/40">
              {cfg.truths.length} {cfg.truths.length === 1 ? "truth" : "truths"}
            </div>
          </SidePanel>
          <SidePanel title="Dares">
            <textarea
              value={drafts.dares}
              onChange={(e) => edit("dares", e.target.value)}
              rows={6}
              placeholder="One dare per line"
              aria-label="Dares"
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-white/25"
            />
            <div className="mt-2 text-[11px] text-white/40">
              {cfg.dares.length} {cfg.dares.length === 1 ? "dare" : "dares"}
            </div>
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          Truth or dare?
        </p>
        <div
          className="grid min-h-[14rem] w-full flex-1 place-items-center"
          aria-live="polite"
        >
          <AnimatePresence mode="wait">
            {prompt ? (
              <motion.div
                key={round}
                initial={{ opacity: 0, y: 24, rotateX: 60 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                // A short tween out, so the next card is already landing well
                // inside REVEAL_MS instead of waiting on a spring to settle.
                exit={{
                  opacity: 0,
                  y: -24,
                  rotateX: -60,
                  transition: { duration: 0.2, ease: "easeIn" },
                }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="max-w-lg text-center"
                /*
                 * `transformPerspective`, not `perspective`. The CSS property
                 * only applies depth to an element's children, so on the card
                 * itself the rotateX flip rendered as a flat vertical squash.
                 */
                style={{ transformPerspective: 800 }}
              >
                <span
                  className="mb-4 inline-block rounded-full px-4 py-1 text-xs font-bold uppercase tracking-widest text-white"
                  style={{ background: accent }}
                >
                  {kind}
                </span>
                <p className="px-4 text-3xl font-bold leading-snug text-white [overflow-wrap:anywhere] sm:text-4xl">
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
                {nothing ? "Add a truth or a dare to play." : "Choose your fate."}
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
            disabled={nothing}
            className="rounded-2xl border border-white/15 bg-white/5 px-7 py-4 text-base font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50"
          >
            🎲 Surprise me
          </motion.button>
        </div>
      </div>
    </EngineShell>
  );
}

/** A stored list as textarea text, tolerating hand-edited storage that isn't an array. */
const lines = (v: unknown) =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string").join("\n") : "";

/** One prompt per line (prompts are sentences, so commas stay), trimmed, blanks and repeats dropped. */
function parseLines(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const k = line.toLocaleLowerCase();
    if (!line || seen.has(k)) continue;
    seen.add(k);
    out.push(line);
  }
  return out;
}
