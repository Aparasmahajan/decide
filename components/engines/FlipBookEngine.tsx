"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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

/*
 * One page turn. The same constant spaces the turns and times each turn's
 * animation, so a page always finishes landing exactly as the next one starts
 * — and the result is recorded one turn after the last page starts, i.e. once
 * it has actually landed rather than while it is still edge-on.
 */
const PAGE_MS = 180;
const FLIPS = 6;

const parsePages = (text: string) =>
  text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

/* Longer pages step down in size so they stay inside the page. */
const pageSize = (text: string) =>
  text.length > 90
    ? "text-base line-clamp-[10]"
    : text.length > 40
      ? "text-lg"
      : "text-2xl";

export default function FlipBookEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<FlipConfig>(DEFAULT);
  /*
   * The textarea edits raw text; the page list is derived from it. Binding the
   * textarea to `pages.join("\n")` round-tripped every keystroke through
   * trim/filter, which deleted a space typed at the end of a line and a
   * newline typed at the end of the text — so "Go for it" typed normally came
   * out as "Goforit", and pressing Enter to add a page did nothing.
   */
  const [draft, setDraft] = useState(DEFAULT.pages.join("\n"));
  const [page, setPage] = useState<string | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [flipKey, setFlipKey] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reduce = useReducedMotion();

  useEffect(() => {
    const stored = readConfig<FlipConfig>(engine.slug, DEFAULT);
    const pages = Array.isArray(stored.pages) ? stored.pages : DEFAULT.pages;
    setCfg({ ...stored, pages });
    setDraft(pages.join("\n"));
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
    // Decided up front from the pages as they were when you flipped, so an
    // edit mid-flip can't land on a page that no longer exists.
    const pages = cfg.pages;
    const final = pick(pages);
    setFlipping(true);
    timers.current.forEach(clearTimeout);
    timers.current = [];

    for (let i = 0; i < FLIPS; i++) {
      timers.current.push(
        setTimeout(() => {
          setPage(pick(pages));
          setFlipKey((k) => k + 1);
        }, i * PAGE_MS),
      );
    }
    timers.current.push(
      setTimeout(() => {
        setPage(final);
        setFlipKey((k) => k + 1);
      }, FLIPS * PAGE_MS),
    );
    timers.current.push(
      setTimeout(() => {
        setFlipping(false);
        pushHistory({ engineId: engine.slug, outcome: final });
      }, (FLIPS + 1) * PAGE_MS),
    );
  };

  const text = page ?? "Open the book";

  return (
    <EngineShell
      engine={engine}
      variant="warm"
      side={
        <SidePanel title="Pages">
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              persist({ pages: parsePages(e.target.value) });
            }}
            rows={10}
            placeholder="One page per line"
            aria-label="Pages, one per line"
            className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-white/25"
          />
          <div className="mt-2 text-[11px] text-white/40">
            {cfg.pages.length} {cfg.pages.length === 1 ? "page" : "pages"} in
            the book
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
            {/*
              Every page is absolutely stacked over the same box, so the
              outgoing and incoming pages simply overlap. This used to be
              `mode="popLayout"`, which measures the leaving page and injects
              a positioning stylesheet for it — a forced layout plus a
              document-wide style recalc on every turn, seven times a flip.
            */}
            <AnimatePresence>
              <motion.div
                key={flipKey}
                initial={{ rotateY: reduce ? 0 : -90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: reduce ? 0 : 90, opacity: 0 }}
                transition={{ duration: PAGE_MS / 1000 }}
                style={{
                  transformOrigin: "left center",
                  backfaceVisibility: "hidden",
                }}
                className="absolute inset-0 flex items-center justify-center overflow-hidden px-8 py-6"
              >
                <p
                  className={`w-full break-words font-bold leading-snug text-slate-800 ${pageSize(text)}`}
                >
                  {text}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
          {/* Announce the page it lands on, not every page it riffles past. */}
          <span className="sr-only" aria-live="polite">
            {!flipping && page ? page : ""}
          </span>
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
