"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory } from "@/lib/storage";
import { pick } from "@/lib/random";

const CATEGORIES: Record<string, string[]> = {
  Smileys:
    "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😍 🥰 😘 😗 😙 😚 🤩 🤔 🤨 😐 🙄 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 😎 🤓 🥸 🤠"
      .split(" "),
  Gestures: "👍 👎 👏 🙏 🙌 👋 🤟 🤘 👌 🤝 ✌️ 🤞 🫶 💪 👑 🎉 🎊 ✨ 💫 🎁".split(" "),
  Animals:
    "🐶 🐱 🦊 🐻 🐼 🐨 🦁 🐯 🐷 🐮 🐸 🐵 🦄 🐴 🦉 🦅 🐢 🐬 🐳 🦋 🐝 🦁"
      .split(" "),
  Food:
    "🍕 🍔 🍟 🌭 🍿 🥪 🌮 🌯 🥗 🍝 🍜 🍣 🍱 🍩 🍪 🍰 🎂 🍫 🍩 ☕️ 🍺 🍷 🍹 🍎 🍓 🍇 🥑"
      .split(" "),
  Objects:
    "🎲 🎮 🎧 🎸 🥁 🎺 🎷 🎻 🎨 📚 💡 💎 🔑 🎁 🎯 🎳 🏆 🥇 🚀 🛸 🎪 🎭 🎬 🎤"
      .split(" "),
  Weather: "☀️ 🌤 ⛅️ 🌥 ☁️ 🌦 🌧 ⛈ 🌩 🌨 ❄️ ☃️ ⛄️ 🌬 💨 🌪 🌫 🌊 💦 💧 ☔️ 🌈".split(" "),
};

export default function EmojiEngine({ engine }: { engine: EngineDef }) {
  const [cat, setCat] = useState<keyof typeof CATEGORIES>("Smileys");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);

  const generate = () => {
    if (rolling) return;
    setRolling(true);
    let n = 0;
    const iv = setInterval(() => {
      setEmoji(pick(CATEGORIES[cat]));
      n++;
      if (n > 12) {
        clearInterval(iv);
        const e = pick(CATEGORIES[cat]);
        setEmoji(e);
        setRolling(false);
        pushHistory({ engineId: engine.slug, outcome: `${e}` });
      }
    }, 80);
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
                className={
                  "rounded-xl px-3 py-2 text-sm transition-all " +
                  (cat === k
                    ? "bg-white text-ink-950 shadow-glow"
                    : "bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white")
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
        <div className="grid flex-1 place-items-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={emoji ?? "empty"}
              initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 250, damping: 15 }}
              className="text-[200px] leading-none drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
            >
              {emoji ?? "❓"}
            </motion.div>
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
