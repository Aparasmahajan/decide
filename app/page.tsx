"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import { Search, Sparkles, Wand2, Zap } from "lucide-react";
import AuroraBackground from "@/components/AuroraBackground";
import ParticleField from "@/components/ParticleField";
import Nav from "@/components/Nav";
import EngineTile from "@/components/EngineTile";
import { ENGINES } from "@/lib/engines";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  "All",
  "Classics",
  "Groups",
  "Numbers",
  "Play",
  "Everyday",
  "Random",
] as const;

export default function HomePage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");
  const reduce = useReducedMotion();
  const router = useRouter();

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return ENGINES.filter((e) => {
      if (cat !== "All" && e.category !== cat) return false;
      if (!ql) return true;
      return (
        e.name.toLowerCase().includes(ql) ||
        e.tagline.toLowerCase().includes(ql) ||
        e.category.toLowerCase().includes(ql)
      );
    });
  }, [q, cat]);

  const surprise = () => {
    const live = ENGINES.filter((e) => e.status === "live");
    const pick = live[Math.floor(Math.random() * live.length)];
    router.push(`/engine/${pick.slug}`);
  };

  return (
    <div className="relative min-h-screen">
      <AuroraBackground />
      <ParticleField count={80} />
      <Nav />

      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-6 pt-14 sm:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="flex justify-center"
        >
          <div className="chip">
            <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
            <span>26 beautifully-crafted decision engines</span>
          </div>
        </motion.div>

        <div className="relative mt-8 flex flex-col items-center text-center">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 0.9, 0.28, 1] }}
            className="text-balance text-[46px] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-[72px] lg:text-[96px]"
          >
            <span className="text-gradient">Can&apos;t decide?</span>
            <br />
            <span className="text-gradient-warm">Let fate do it.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-6 max-w-xl text-balance text-[15px] leading-relaxed text-white/60 sm:text-lg"
          >
            A playground of coins, dice, wheels and wonders — the fastest,
            most delightful way to turn any choice into a moment.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-3"
          >
            <a
              href="#engines"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-ink-950 shadow-glow transition-transform hover:scale-[1.02]"
            >
              <Zap className="h-4 w-4" />
              Pick an engine
            </a>
            <button
              onClick={surprise}
              className="group inline-flex items-center gap-2 rounded-full bg-white/5 px-6 py-3 text-sm font-medium text-white ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-white/10"
            >
              <Wand2 className="h-4 w-4 text-fuchsia-300 transition-transform group-hover:-rotate-12" />
              Surprise me
            </button>
          </motion.div>

          {/* Floating micro-widgets */}
          <FloatingHeroWidgets reduce={!!reduce} />
        </div>
      </section>

      {/* Engine grid */}
      <section id="engines" className="mx-auto max-w-7xl px-6 pb-24 pt-24">
        <div className="mb-10 flex flex-col items-center gap-6 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-3xl font-semibold tracking-tight text-white sm:text-5xl"
          >
            Pick your{" "}
            <span className="text-gradient">favorite way</span> to decide.
          </motion.h2>
          <p className="max-w-xl text-white/50">
            Each engine is fully offline, saveable, and endlessly playful.
          </p>

          {/* Search + filter bar */}
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4">
            <div className="glass flex w-full items-center gap-3 rounded-full px-5 py-3">
              <Search className="h-4 w-4 text-white/40" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search engines…"
                className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
              />
              {q && (
                <button
                  onClick={() => setQ("")}
                  className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/60 hover:bg-white/10"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={
                    "rounded-full px-4 py-1.5 text-xs font-medium transition-all " +
                    (cat === c
                      ? "bg-white text-ink-950 shadow-glow"
                      : "bg-white/5 text-white/60 ring-1 ring-white/10 hover:bg-white/10 hover:text-white")
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((e, i) => (
            <EngineTile key={e.slug} engine={e} index={i} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="mt-12 text-center text-white/50">
            No engines match — try a different search.
          </div>
        )}
      </section>

      <footer className="mx-auto max-w-7xl px-6 pb-12 text-center text-xs text-white/40">
        Built with love — everything runs offline, right in your browser.
      </footer>
    </div>
  );
}

function FloatingHeroWidgets({ reduce }: { reduce: boolean }) {
  const widgets = [
    { text: "🪙", pos: "left-[6%] top-[10%]", d: 0.1, rot: -6, y: -16 },
    { text: "🎲", pos: "right-[8%] top-[6%]", d: 0.2, rot: 8, y: -12 },
    { text: "🎡", pos: "left-[3%] top-[62%]", d: 0.4, rot: -12, y: 20 },
    { text: "🎱", pos: "right-[4%] top-[64%]", d: 0.3, rot: 10, y: 18 },
    { text: "🧭", pos: "left-[20%] top-[74%]", d: 0.55, rot: 4, y: 8 },
    { text: "🃏", pos: "right-[20%] top-[8%]", d: 0.35, rot: -8, y: -8 },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {widgets.map((w, i) => (
        <motion.div
          key={i}
          className={`absolute ${w.pos} hidden sm:block`}
          initial={{ opacity: 0, y: 20, rotate: w.rot }}
          animate={{ opacity: 1, y: 0, rotate: w.rot }}
          transition={{ duration: 0.8, delay: w.d, ease: "easeOut" }}
        >
          <motion.div
            className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/5 text-3xl backdrop-blur-xl shadow-soft-lg"
            animate={
              reduce
                ? undefined
                : {
                    y: [0, w.y, 0],
                    rotate: [w.rot, w.rot + 3, w.rot],
                  }
            }
            transition={{
              duration: 6 + i * 0.7,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {w.text}
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}
