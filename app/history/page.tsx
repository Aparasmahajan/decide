"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import AuroraBackground from "@/components/AuroraBackground";
import Nav from "@/components/Nav";
import { clearHistory, readHistory, type HistoryEntry } from "@/lib/storage";
import { ENGINES, findEngine } from "@/lib/engines";

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [engineFilter, setEngineFilter] = useState<string>("all");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setHistory(readHistory());
  }, [tick]);

  const filtered =
    engineFilter === "all"
      ? history
      : history.filter((h) => h.engineId === engineFilter);

  return (
    <div className="relative min-h-screen">
      <AuroraBackground variant="cool" />
      <Nav />
      <div className="mx-auto max-w-5xl px-6 py-12">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-semibold tracking-tight text-white sm:text-5xl"
        >
          Your <span className="text-gradient">history</span>
        </motion.h1>
        <p className="mt-3 text-white/50">
          Everything you've decided lives right here in your browser.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <FilterChip
            active={engineFilter === "all"}
            onClick={() => setEngineFilter("all")}
          >
            All ({history.length})
          </FilterChip>
          {ENGINES.map((e) => {
            const count = history.filter((h) => h.engineId === e.slug).length;
            if (count === 0) return null;
            return (
              <FilterChip
                key={e.slug}
                active={engineFilter === e.slug}
                onClick={() => setEngineFilter(e.slug)}
              >
                {e.emoji} {e.name} ({count})
              </FilterChip>
            );
          })}
          {history.length > 0 && (
            <button
              onClick={() => {
                clearHistory();
                setTick((t) => t + 1);
              }}
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-500/10 px-4 py-1.5 text-xs text-red-300 ring-1 ring-red-500/20 hover:bg-red-500/20"
            >
              <Trash2 className="h-3 w-3" />
              Clear all
            </button>
          )}
        </div>

        <div className="mt-8">
          {filtered.length === 0 ? (
            <div className="glass rounded-3xl p-12 text-center text-white/50">
              <div className="text-4xl">🪄</div>
              <p className="mt-4">
                Nothing yet.{" "}
                <Link href="/" className="text-white underline">
                  Try an engine
                </Link>
                .
              </p>
            </div>
          ) : (
            <ul className="glass overflow-hidden rounded-3xl">
              {filtered.map((h, i) => {
                const engine = findEngine(h.engineId);
                return (
                  <motion.li
                    key={h.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.4) }}
                    className="flex items-center gap-4 border-b border-white/5 px-6 py-4 last:border-b-0"
                  >
                    <div
                      className="grid h-10 w-10 place-items-center rounded-xl text-lg"
                      style={{
                        background: engine
                          ? `linear-gradient(135deg, ${engine.color}, ${engine.color2})`
                          : "rgba(255,255,255,0.1)",
                      }}
                    >
                      {engine?.emoji ?? "•"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-white">{h.outcome}</div>
                      <div className="text-[11px] text-white/40">
                        {engine?.name ?? h.engineId} ·{" "}
                        {new Date(h.timestamp).toLocaleString()}
                      </div>
                    </div>
                    {engine && (
                      <Link
                        href={`/engine/${engine.slug}`}
                        className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
                      >
                        Open
                      </Link>
                    )}
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full px-4 py-1.5 text-xs font-medium transition-all " +
        (active
          ? "bg-white text-ink-950 shadow-glow"
          : "bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white")
      }
    >
      {children}
    </button>
  );
}
