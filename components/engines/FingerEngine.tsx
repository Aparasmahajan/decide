"use client";

import {
  motion,
  motionValue,
  AnimatePresence,
  type MotionValue,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import EngineShell, { SidePanel } from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory } from "@/lib/storage";

type Finger = {
  /** The pointerId. */
  id: number;
  /** Number shown on the circle — and recorded in history. */
  n: number;
  x: MotionValue<number>;
  y: MotionValue<number>;
};

type Status = "idle" | "countdown" | "picked";

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

/** Quiet time after the last finger lands before the countdown starts. */
const SETTLE_MS = 800;
/** Time per countdown number; the digit animation is sized to fit inside it. */
const TICK_MS = 800;
const COUNT_FROM = 3;
/** Finger circle diameter, px (h-20 / w-20). */
const SIZE = 80;

export default function FingerEngine({ engine }: { engine: EngineDef }) {
  /*
   * Fingers in arrival order. Each one's position is a pair of motion values,
   * not state: a pointermove used to setState, re-rendering the whole engine
   * and shell (aurora, particles, side panel…) for every move event of every
   * finger — and writing `left`/`top`, a layout property, each time. Now a move
   * just sets two motion values and framer-motion writes a transform.
   */
  const [fingers, setFingers] = useState<Finger[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [countdown, setCountdown] = useState(COUNT_FROM);

  /*
   * Mirrors of `fingers` and `status` for the timers and pointer handlers.
   * Before, the countdown read `fingers` from the closure of the render that
   * scheduled it — the render *before* the finger that triggered it had been
   * added. A lone finger was therefore never seen ("no fingers" → back to
   * idle), and with several, the newest one could never win.
   */
  const fingersRef = useRef<Finger[]>([]);
  const statusRef = useRef<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const padRect = useRef<DOMRect | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const commit = (next: Finger[]) => {
    fingersRef.current = next;
    setFingers(next);
  };
  const go = (s: Status) => {
    statusRef.current = s;
    setStatus(s);
  };
  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const tick = (n: number) => {
    setCountdown(n);
    if (n > 0) {
      timer.current = setTimeout(() => tick(n - 1), TICK_MS);
      return;
    }
    timer.current = null;
    const live = fingersRef.current;
    if (live.length === 0) {
      go("idle");
      return;
    }
    const winner = live[Math.floor(Math.random() * live.length)];
    setChosen(winner.id);
    go("picked");
    pushHistory({ engineId: engine.slug, outcome: `Finger ${winner.n}` });
  };

  const startCountdown = () => {
    clearTimer();
    setChosen(null);
    go("countdown");
    tick(COUNT_FROM);
  };

  const reset = () => {
    clearTimer();
    commit([]);
    setChosen(null);
    go("idle");
    setCountdown(COUNT_FROM);
  };

  const pointFor = (e: React.PointerEvent) => {
    const r = padRect.current;
    return {
      x: e.clientX - (r?.left ?? 0) - SIZE / 2,
      y: e.clientY - (r?.top ?? 0) - SIZE / 2,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // A right-click isn't a finger.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    // Keep receiving this pointer's move/up even if it slides off the pad, so
    // a mouse released outside can't leave a ghost finger behind.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone */
    }
    // Measured once per touch-down rather than on every move.
    padRect.current = e.currentTarget.getBoundingClientRect();

    let current = fingersRef.current;
    if (statusRef.current === "picked") {
      // The result stays up until the next tap, which starts a fresh round.
      current = [];
      setChosen(null);
      go("idle");
    }
    if (current.some((f) => f.id === e.pointerId)) return;

    // Lowest free number, so numbers and colours don't reshuffle as fingers
    // come and go. (They were the index in a *string*-sorted list of pointer
    // ids — and history recorded the pointer id, not the number on screen.)
    const taken = new Set(current.map((f) => f.n));
    let n = 1;
    while (taken.has(n)) n++;
    const { x, y } = pointFor(e);
    commit([...current, { id: e.pointerId, n, x: motionValue(x), y: motionValue(y) }]);

    if (statusRef.current === "idle") {
      // Each new finger pushes the start back, so everyone has time to land.
      clearTimer();
      timer.current = setTimeout(startCountdown, SETTLE_MS);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (statusRef.current === "picked") return;
    const f = fingersRef.current.find((f) => f.id === e.pointerId);
    if (!f) return;
    const { x, y } = pointFor(e);
    f.x.set(x);
    f.y.set(y);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (statusRef.current === "picked") return;
    const next = fingersRef.current.filter((f) => f.id !== e.pointerId);
    if (next.length === fingersRef.current.length) return;
    commit(next);
    if (next.length === 0) {
      clearTimer();
      go("idle");
      setCountdown(COUNT_FROM);
    }
  };

  const winner = fingers.find((f) => f.id === chosen);

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
            <li>4. Tap again for another round.</li>
          </ol>
          <p className="mt-3 text-[11px] text-white/40">
            Uses pointer events — works with mouse or touch.
          </p>
        </SidePanel>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-6">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          {status === "picked" && winner
            ? `Finger ${winner.n} is chosen!`
            : status === "countdown" || fingers.length > 0
              ? "Hold on…"
              : "Tap the pad"}
        </p>
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative aspect-square w-full max-w-md touch-none select-none rounded-3xl border border-white/10 bg-white/[0.03]"
          style={{ touchAction: "none" }}
        >
          {fingers.length === 0 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-white/40">
              Place fingers here
            </div>
          )}
          {fingers.map((f) => {
            const color = COLORS[(f.n - 1) % COLORS.length];
            const isChosen = chosen === f.id;
            return (
              <motion.div
                key={f.id}
                animate={{
                  scale: isChosen ? 1.4 : 1,
                  opacity: status === "picked" && !isChosen ? 0.35 : 1,
                }}
                transition={{
                  type: "spring",
                  stiffness: 250,
                  opacity: { duration: 0.3 },
                }}
                className="pointer-events-none absolute left-0 top-0 h-20 w-20"
                style={{ x: f.x, y: f.y }}
              >
                {/*
                  The winner's glow is a fixed shadow faded in by opacity. It
                  was a `boxShadow` animated by a spring: an 80px blur
                  repainted every frame, right as the result landed.
                */}
                <motion.div
                  aria-hidden
                  className="absolute inset-0 rounded-full"
                  style={{ boxShadow: `0 0 40px ${color}, 0 0 80px ${color}88` }}
                  initial={false}
                  animate={{ opacity: isChosen ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                />
                <div
                  className="relative grid h-full w-full place-items-center rounded-full"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${color}dd, ${color}66)`,
                    boxShadow: `0 0 20px ${color}66`,
                  }}
                >
                  <span className="text-lg font-bold text-white">{f.n}</span>
                </div>
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
                {/*
                  Its own AnimatePresence, or the outgoing digit's `exit` never
                  runs — it just vanished. Both digits share one grid cell so
                  the outgoing one doesn't push the incoming one down.
                */}
                <AnimatePresence>
                  <motion.div
                    key={countdown}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 0.8 }}
                    exit={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 0.7 }}
                    className="col-start-1 row-start-1 text-[220px] font-black leading-none text-white/70"
                  >
                    {countdown}
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-3">
          {status !== "idle" && (
            <button
              onClick={reset}
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
