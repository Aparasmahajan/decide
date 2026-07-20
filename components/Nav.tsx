"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Dices, Sparkles } from "lucide-react";

export default function Nav() {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      className="sticky top-0 z-40"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/" className="group flex items-center gap-2.5">
          <motion.div
            whileHover={{ rotate: 20, scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-400 via-fuchsia-400 to-sky-400 shadow-glow"
          >
            <Dices className="h-4 w-4 text-ink-950" strokeWidth={2.5} />
          </motion.div>
          <span className="text-[17px] font-semibold tracking-tight text-white">
            Decide
          </span>
          <span className="hidden text-[11px] font-medium uppercase tracking-[0.14em] text-white/40 sm:inline">
            · Random Decision Engine
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            href="/#engines"
            className="hidden rounded-full px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white sm:inline-flex"
          >
            Engines
          </Link>
          <Link
            href="/history"
            className="hidden rounded-full px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white sm:inline-flex"
          >
            History
          </Link>
          <Link
            href="/#engines"
            className="group inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 transition-all hover:bg-white/20"
          >
            <Sparkles className="h-3.5 w-3.5 text-yellow-300 transition-transform group-hover:rotate-12" />
            Start deciding
          </Link>
        </nav>
      </div>
    </motion.header>
  );
}
