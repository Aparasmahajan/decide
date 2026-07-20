"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, History, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import AuroraBackground from "./AuroraBackground";
import ParticleField from "./ParticleField";
import Nav from "./Nav";
import { clearHistory, readHistory, type HistoryEntry } from "@/lib/storage";
import type { EngineDef } from "@/lib/engines";
import { cn } from "@/lib/cn";

type Props = {
  engine: EngineDef;
  children: React.ReactNode;
  side?: React.ReactNode;
  variant?: "default" | "warm" | "cool" | "aurora";
};

export default function EngineShell({
  engine,
  children,
  side,
  variant = "default",
}: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setHistory(readHistory(engine.slug));
  }, [engine.slug, tick]);

  return (
    <div className="relative min-h-screen">
      <AuroraBackground variant={variant} />
      <ParticleField count={45} />
      <Nav />

      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 pb-24 pt-4 lg:pt-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="group inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-white/70 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              All engines
            </Link>
            <div className="hidden sm:block">
              <div className="flex items-center gap-3">
                <div
                  className="grid h-10 w-10 place-items-center rounded-xl text-xl"
                  style={{
                    background: `linear-gradient(135deg, ${engine.color}, ${engine.color2})`,
                  }}
                >
                  {engine.emoji}
                </div>
                <div>
                  <h1 className="text-lg font-semibold tracking-tight text-white">
                    {engine.name}
                  </h1>
                  <p className="text-xs text-white/50">{engine.tagline}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory((s) => !s)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm ring-1 transition-colors",
                showHistory
                  ? "bg-white/15 text-white ring-white/20"
                  : "bg-white/5 text-white/70 ring-white/10 hover:bg-white/10 hover:text-white",
              )}
            >
              <History className="h-4 w-4" />
              History
              {history.length > 0 && (
                <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-mono">
                  {history.length}
                </span>
              )}
            </button>
          </div>
        </motion.div>

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <div className="glass min-h-[520px] rounded-3xl p-6 sm:p-10">
            {children}
          </div>
          <aside className="flex flex-col gap-4">
            {side}
            <AnimatePresence initial={false}>
              {showHistory && (
                <motion.div
                  initial={{ opacity: 0, y: 10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: 10, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="glass overflow-hidden rounded-3xl"
                >
                  <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
                    <p className="text-sm font-medium text-white/80">
                      Recent outcomes
                    </p>
                    <button
                      onClick={() => {
                        clearHistory(engine.slug);
                        setTick((t) => t + 1);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-white/50 transition-colors hover:bg-white/5 hover:text-white/80"
                    >
                      <Trash2 className="h-3 w-3" />
                      Clear
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {history.length === 0 ? (
                      <div className="p-6 text-center text-sm text-white/40">
                        <RotateCcw className="mx-auto mb-2 h-5 w-5 opacity-40" />
                        No history yet.
                      </div>
                    ) : (
                      <ul className="divide-y divide-white/5">
                        {history.map((h) => (
                          <li
                            key={h.id}
                            className="flex items-center justify-between px-5 py-3 text-sm"
                          >
                            <span className="max-w-[220px] truncate text-white/85">
                              {h.outcome}
                            </span>
                            <span className="text-[11px] tabular-nums text-white/40">
                              {relTime(h.timestamp)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </aside>
        </div>
      </div>
    </div>
  );
}

function relTime(ts: number) {
  const d = Date.now() - ts;
  const s = Math.floor(d / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function SidePanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-3xl">
      <div className="border-b border-white/5 px-5 py-3">
        <p className="text-sm font-medium text-white/80">{title}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/** A small trigger button used by engines for a big playful action. */
export function BigActionButton({
  label,
  onClick,
  disabled,
  color = "#8b5cf6",
  color2 = "#38bdf8",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  color?: string;
  color2?: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl px-8 py-4 text-base font-semibold text-white disabled:opacity-50"
      style={{
        background: `linear-gradient(135deg, ${color}, ${color2})`,
        boxShadow: `0 12px 30px -8px ${color}88, 0 24px 60px -10px ${color2}55, inset 0 1px 0 rgba(255,255,255,0.35)`,
      }}
    >
      <span className="relative z-10">{label}</span>
      <span
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
        style={{ mixBlendMode: "overlay" }}
      />
    </motion.button>
  );
}
