"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import EngineShell, { SidePanel } from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory } from "@/lib/storage";

type Finger = {
  id: number;
  x: number;
  y: number;
};

const COLORS = [
  "#f472b6",
  "#38bdf8",
  "#22c55e",
  "#facc15",
  "#a855f7",
  "#f97316",
  "#22d3ee",
  "#ef4444",
];

export default function FingerEngine({ engine }: { engine: EngineDef }) {
  const [fingers, setFingers] = useState<Record<number, Finger>>({});
  const [chosen, setChosen] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "countdown" | "picked">("idle");
  const [countdown, setCountdown] = useState(3);
  const timerRef = useRef<number | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const startCountdown = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus("countdown");
    setChosen(null);
    setCountdown(3);
    const tick = (n: number) => {
      setCountdown(n);
      if (n === 0) {
        // pick from currently placed fingers
        const ids = Object.keys(fingers).map(Number);
        if (ids.length === 0) {
          setStatus("idle");
          return;
        }
        const winner = ids[Math.floor(Math.random() * ids.length)];
        setChosen(winner);
        setStatus("picked");
        pushHistory({ engineId: engine.slug, outcome: `Finger ${winner + 1}` });
      } else {
        timerRef.current = window.setTimeout(() => tick(n - 1), 800) as unknown as number;
      }
    };
    tick(3);
  };

  const cancel = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus("idle");
    setCountdown(3);
    setChosen(null);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) return;
    setFingers((prev) => ({
      ...prev,
      [e.pointerId]: {
        id: e.pointerId,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      },
    }));
    if (status === "idle") {
      // give a moment then start when at least 1 finger present
      setTimeout(() => {
        setFingers((f) => {
          if (Object.keys(f).length > 0 && status === "idle") startCountdown();
          return f;
        });
      }, 800);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!(e.pointerId in fingers)) return;
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) return;
    setFingers((prev) => ({
      ...prev,
      [e.pointerId]: {
        id: e.pointerId,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      },
    }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (status === "picked") return;
    setFingers((prev) => {
      const { [e.pointerId]: _, ...rest } = prev;
      if (Object.keys(rest).length === 0) cancel();
      return rest;
    });
  };

  const idsOrdered = Object.keys(fingers).map(Number).sort();

  return (
    <EngineShell
      engine={engine}
      variant="warm"
      side={
        <SidePanel title="How to play">
          <ol className="space-y-2 text-sm text-white/70">
            <li>1. Each player places a finger on the circle.</li>
            <li>2. Hold still — the countdown starts.</li>
            <li>3. At zero, one finger is chosen.</li>
          </ol>
          <p className="mt-3 text-[11px] text-white/40">
            Uses pointer events — works with mouse or touch.
          </p>
        </SidePanel>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-6">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          {status === "idle"
            ? "Tap the pad"
            : status === "countdown"
              ? "Hold on…"
              : "Chosen!"}
        </p>
        <div
          ref={areaRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative aspect-square w-full max-w-md touch-none select-none rounded-3xl border border-white/10 bg-white/[0.03]"
          style={{ touchAction: "none" }}
        >
          {idsOrdered.length === 0 && (
            <div className="absolute inset-0 grid place-items-center text-sm text-white/40">
              Place fingers here
            </div>
          )}
          {idsOrdered.map((id, i) => {
            const f = fingers[id];
            const color = COLORS[i % COLORS.length];
            const isChosen = chosen === id;
            return (
              <motion.div
                key={id}
                animate={{
                  scale: isChosen ? 1.4 : 1,
                  boxShadow: isChosen
                    ? `0 0 40px ${color}, 0 0 80px ${color}88`
                    : `0 0 20px ${color}66`,
                }}
                transition={{ type: "spring", stiffness: 250 }}
                className="pointer-events-none absolute grid h-20 w-20 place-items-center rounded-full"
                style={{
                  left: f.x - 40,
                  top: f.y - 40,
                  background: `radial-gradient(circle at 30% 30%, ${color}dd, ${color}66)`,
                }}
              >
                <span className="text-lg font-bold text-white">
                  {i + 1}
                </span>
              </motion.div>
            );
          })}

          <AnimatePresence>
            {status === "countdown" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-0 grid place-items-center"
              >
                <motion.div
                  key={countdown}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.8 }}
                  exit={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 0.7 }}
                  className="text-[220px] font-black leading-none text-white/70"
                >
                  {countdown === 0 ? "!" : countdown}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-3">
          {status !== "idle" && (
            <button
              onClick={cancel}
              className="rounded-full bg-white/5 px-5 py-2 text-sm text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </EngineShell>
  );
}
