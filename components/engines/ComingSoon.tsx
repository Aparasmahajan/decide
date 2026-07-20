"use client";

import EngineShell from "@/components/EngineShell";
import { motion } from "framer-motion";
import type { EngineDef } from "@/lib/engines";
import { Sparkles } from "lucide-react";

export default function ComingSoon({ engine }: { engine: EngineDef }) {
  return (
    <EngineShell engine={engine}>
      <div className="grid min-h-[400px] place-items-center text-center">
        <div>
          <motion.div
            initial={{ scale: 0.6, rotate: -10, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="mx-auto mb-8 grid h-28 w-28 place-items-center rounded-3xl text-6xl"
            style={{
              background: `linear-gradient(135deg, ${engine.color}, ${engine.color2})`,
              boxShadow: `0 20px 60px -20px ${engine.color}66`,
            }}
          >
            {engine.emoji}
          </motion.div>
          <h2 className="mb-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {engine.name}
          </h2>
          <p className="mx-auto max-w-md text-white/60">{engine.tagline}</p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs text-white/60 ring-1 ring-white/10">
            <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
            Beautifully polished version — coming soon.
          </div>
        </div>
      </div>
    </EngineShell>
  );
}
