"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory } from "@/lib/storage";
import { pick, randomInt } from "@/lib/random";

/** Space-separated, de-duplicated — a repeat is a silently doubled weight. */
const list = (s: string) => Array.from(new Set(s.split(" ")));

/*
 * The weather symbols carry U+FE0F (emoji presentation). 🌤 🌥 🌦 🌧 ⛈ 🌩 🌨 🌬
 * 🌪 🌫 default to *text* presentation, so without it several platforms —
 * Windows among them — drew them as small monochrome glyphs at 200px.
 */
const CATEGORIES: Record<string, string[]> = {
  Smileys: list(
    "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😍 🥰 😘 😗 😙 😚 🤩 🤔 🤨 😐 🙄 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 😎 🤓 🥸 🤠",
  ),
  Gestures: list("👍 👎 👏 🙏 🙌 👋 🤟 🤘 👌 🤝 ✌️ 🤞 🫶 💪 👑 🎉 🎊 ✨ 💫 🎁"),
  Animals: list(
    "🐶 🐱 🦊 🐻 🐼 🐨 🦁 🐯 🐷 🐮 🐸 🐵 🦄 🐴 🦉 🦅 🐢 🐬 🐳 🦋 🐝",
  ),
  Food: list(
    "🍕 🍔 🍟 🌭 🍿 🥪 🌮 🌯 🥗 🍝 🍜 🍣 🍱 🍩 🍪 🍰 🎂 🍫 ☕️ 🍺 🍷 🍹 🍎 🍓 🍇 🥑",
  ),
  Objects: list(
    "🎲 🎮 🎧 🎸 🥁 🎺 🎷 🎻 🎨 📚 💡 💎 🔑 🎁 🎯 🎳 🏆 🥇 🚀 🛸 🎪 🎭 🎬 🎤",
  ),
  Weather: list(
    "☀️ 🌤️ ⛅️ 🌥️ ☁️ 🌦️ 🌧️ ⛈️ 🌩️ 🌨️ ❄️ ☃️ ⛄️ 🌬️ 💨 🌪️ 🌫️ 🌊 💦 💧 ☔️ 🌈",
  ),
};

/** The whole pick, first flicker to reveal. */
const ROLL_MS = 1000;
/** How often the emoji changes while picking. */
const FLICKER_MS = 80;

const GLYPH =
  "text-[200px] leading-none drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)]";
/** Every state shares one grid cell, so an exit and an entrance overlap in place. */
const CELL = { gridArea: "1 / 1" } as const;

export default function EmojiEngine({ engine }: { engine: EngineDef }) {
  const [cat, setCat] = useState<keyof typeof CATEGORIES>("Smileys");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  /** Bumped per pick so the reveal replays even when the emoji repeats. */
  const [round, setRound] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const generate = () => {
    if (rolling) return;
    const e = pick(CATEGORIES[cat]);
    setRolling(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setEmoji(e);
      setRound((r) => r + 1);
      setRolling(false);
      pushHistory({ engineId: engine.slug, outcome: e });
    }, ROLL_MS);
  };

  return (
    <EngineShell
      engine={engine}
      variant="warm"
      side={
        <SidePanel title="Category">
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(CATEGORIES).map((k) => (
              <button
                key={k}
                onClick={() => setCat(k as keyof typeof CATEGORIES)}
                disabled={rolling}
                aria-pressed={cat === k}
                className={
                  "rounded-xl px-3 py-2 text-sm transition-all disabled:cursor-not-allowed " +
                  (cat === k
                    ? "bg-white text-ink-950 shadow-glow"
                    : "bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white disabled:opacity-50")
                }
              >
                {k}
              </button>
            ))}
          </div>
        </SidePanel>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-10">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          {cat}
        </p>
        {/*
          The flicker used to be keyed by the emoji inside a `mode="wait"`
          AnimatePresence: a new key every 80ms, each one held back until the
          previous one's half-second spring exit had finished. Most picks never
          showed, the stage sat mid-fade for the whole roll, and the final emoji
          surfaced well after the result had been recorded. Now the flicker is
          one element that just swaps its text, and only the result animates.
        */}
        <div className="grid flex-1 place-items-center">
          <AnimatePresence>
            {rolling ? (
              <Flicker key="flicker" pool={CATEGORIES[cat]} />
            ) : (
              <motion.div
                key={round}
                initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.8, opacity: 0, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 250, damping: 15 }}
                className={GLYPH}
                style={CELL}
              >
                {emoji ?? "❓"}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <BigActionButton
          label={rolling ? "Picking…" : "Pick emoji"}
          onClick={generate}
          disabled={rolling}
          color="#fbbf24"
          color2="#f472b6"
        />
      </div>
    </EngineShell>
  );
}

/** Cycles through the pool while picking; re-renders itself, not the page. */
function Flicker({ pool }: { pool: string[] }) {
  // Only ever mounted after a click, so a random start can't mismatch SSR.
  const [i, setI] = useState(() => randomInt(0, pool.length - 1));

  useEffect(() => {
    const n = pool.length;
    // Always step to a *different* emoji, so the flicker never looks stuck.
    const id = setInterval(
      () => setI((prev) => (prev + randomInt(1, Math.max(1, n - 1))) % n),
      FLICKER_MS,
    );
    return () => clearInterval(id);
  }, [pool.length]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      className={GLYPH}
      style={CELL}
    >
      {pool[i % pool.length]}
    </motion.div>
  );
}
