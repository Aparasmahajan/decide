"use client";

import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { randomInt } from "@/lib/random";

type TimerConfig = { minSec: number; maxSec: number };
const DEFAULT: TimerConfig = { minSec: 10, maxSec: 60 };

/* Five digits is the most the readout can show inside the ring. */
const MAX_SEC = 99_999;
const clampSec = (n: number) => Math.max(1, Math.min(MAX_SEC, Math.round(n)));

const R = 140;
const CIRC = 2 * Math.PI * R;

/*
 * SVG gradient ids are document-global, so a bare "ring" could resolve to
 * some other component's gradient. Namespaced and static rather than
 * `useId()`: behind `next/dynamic` the server and client trees differ in
 * depth, and the generated id mismatched on hydration.
 */
const GRAD_ID = "timer-engine-ring";

type Phase = "idle" | "running" | "paused" | "done";

function normalize(c: TimerConfig): TimerConfig {
  return {
    minSec: Number.isFinite(c.minSec) ? clampSec(c.minSec) : DEFAULT.minSec,
    maxSec: Number.isFinite(c.maxSec) ? clampSec(c.maxSec) : DEFAULT.maxSec,
  };
}

export default function TimerEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<TimerConfig>(DEFAULT);
  const [phase, setPhase] = useState<Phase>("idle");

  /*
   * Time is measured, not counted. The old version subtracted 0.1 from state
   * on every 100ms interval, so it ran slow by however late each callback
   * fired — and a background tab throttles intervals to once a second or
   * worse, so a 60s timer could take minutes. Now there is one deadline, and
   * each frame derives what is left from the clock.
   *
   * The ring and the readout are motion values written from a rAF loop, so a
   * running timer never re-renders React: previously every 100ms tick
   * re-rendered the whole engine and restarted a framer tween on the ring.
   */
  const endAt = useRef(0);
  const leftMs = useRef(0);
  const totalMs = useRef(0);
  const raf = useRef(0);
  const deadline = useRef<number | null>(null);
  const live = useRef(false);

  const progress = useMotionValue(0);
  const dashOffset = useTransform(progress, (p) => CIRC * (1 - p));
  const secs = useMotionValue("—");

  useEffect(() => {
    setCfg(normalize(readConfig<TimerConfig>(engine.slug, DEFAULT)));
  }, [engine.slug]);

  useEffect(
    () => () => {
      live.current = false;
      cancelAnimationFrame(raf.current);
      if (deadline.current !== null) clearTimeout(deadline.current);
    },
    [],
  );

  const persist = (patch: Partial<TimerConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      writeConfig(engine.slug, next);
      return next;
    });
  };

  const stopClock = () => {
    live.current = false;
    cancelAnimationFrame(raf.current);
    if (deadline.current !== null) clearTimeout(deadline.current);
    deadline.current = null;
  };

  const show = (ms: number) => {
    progress.set(1 - ms / totalMs.current);
    secs.set(String(Math.ceil(ms / 1000)));
  };

  const finish = () => {
    if (!live.current) return;
    stopClock();
    progress.set(1);
    secs.set("0");
    setPhase("done");
    pushHistory({
      engineId: engine.slug,
      outcome: `Timer ${Math.round(totalMs.current / 1000)}s done`,
    });
  };

  const runClock = () => {
    live.current = true;
    const frame = () => {
      const ms = endAt.current - performance.now();
      if (ms <= 0) return finish();
      show(ms);
      raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
    // rAF doesn't run at all in a background tab, so the deadline is armed
    // separately: a single timeout isn't subject to chained-timer throttling,
    // and the alarm still goes off (and lands in history) while you're away.
    deadline.current = window.setTimeout(
      finish,
      Math.max(0, endAt.current - performance.now()),
    );
  };

  const start = () => {
    if (phase === "running") return;
    stopClock();
    const lo = Math.min(cfg.minSec, cfg.maxSec);
    const hi = Math.max(cfg.minSec, cfg.maxSec);
    totalMs.current = randomInt(lo, hi) * 1000;
    endAt.current = performance.now() + totalMs.current;
    show(totalMs.current);
    setPhase("running");
    runClock();
  };

  const pause = () => {
    if (phase !== "running") return;
    stopClock();
    leftMs.current = Math.max(0, endAt.current - performance.now());
    show(leftMs.current);
    setPhase("paused");
  };

  const resume = () => {
    if (phase !== "paused") return;
    endAt.current = performance.now() + leftMs.current;
    setPhase("running");
    runClock();
  };

  const reset = () => {
    stopClock();
    progress.set(0);
    secs.set("—");
    setPhase("idle");
  };

  const action =
    phase === "running"
      ? { label: "Pause", onClick: pause }
      : phase === "paused"
        ? { label: "Resume", onClick: resume }
        : { label: phase === "done" ? "Roll another" : "Start", onClick: start };

  return (
    <EngineShell
      engine={engine}
      variant="aurora"
      side={
        <SidePanel title="Range">
          <div className="space-y-3">
            <NumInput
              label="Min (sec)"
              value={cfg.minSec}
              onChange={(v) => persist({ minSec: v })}
            />
            <NumInput
              label="Max (sec)"
              value={cfg.maxSec}
              onChange={(v) => persist({ maxSec: v })}
            />
          </div>
          <p className="mt-3 text-[11px] text-white/40">
            Great for kids, tasks, breaks, or games with variable timing.
          </p>
        </SidePanel>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          Surprise timer
        </p>
        <div className="relative grid flex-1 w-full place-items-center">
          {/* Fluid up to 320px so the ring fits a phone-width panel. */}
          <div className="relative aspect-square w-full max-w-[320px]">
            <svg viewBox="0 0 320 320" className="absolute inset-0 h-full w-full">
              <defs>
                <linearGradient id={GRAD_ID} x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" />
                  <stop offset="100%" stopColor="#eab308" />
                </linearGradient>
              </defs>
              <circle
                cx="160"
                cy="160"
                r={R}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="14"
                fill="none"
              />
              <motion.circle
                cx="160"
                cy="160"
                r={R}
                stroke={`url(#${GRAD_ID})`}
                strokeWidth="14"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={CIRC}
                style={{ strokeDashoffset: dashOffset }}
                transform="rotate(-90 160 160)"
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <AnimatePresence mode="wait">
                {phase === "done" ? (
                  <motion.div
                    key="done"
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center"
                    role="status"
                  >
                    <div className="text-6xl">⏰</div>
                    <div className="mt-1 text-2xl font-bold text-white">
                      Time's up!
                    </div>
                  </motion.div>
                ) : (
                  <div key="count" className="text-center">
                    <motion.div className="text-6xl font-black tabular-nums text-gradient sm:text-7xl">
                      {secs}
                    </motion.div>
                    <div className="text-xs uppercase tracking-widest text-white/40">
                      {phase === "running"
                        ? "seconds left"
                        : phase === "paused"
                          ? "paused"
                          : "seconds"}
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <BigActionButton
            label={action.label}
            onClick={action.onClick}
            color="#22c55e"
            color2="#eab308"
          />
          {phase !== "idle" && (
            <button
              onClick={reset}
              className="rounded-full bg-white/5 px-5 py-3 text-sm text-white/80 ring-1 ring-white/10 hover:bg-white/10"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </EngineShell>
  );
}

/*
 * Holds its own text and only reports once the text parses. Coercing every
 * keystroke (`Math.max(1, parseInt(...) || 1)`) meant clearing the field to
 * type "30" produced "130", because the empty field snapped straight to 1.
 */
function NumInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText((t) => {
      const n = parseFloat(t);
      return Number.isFinite(n) && clampSec(n) === value ? t : String(value);
    });
  }, [value]);

  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-widest text-white/40">
        {label}
      </span>
      <input
        type="number"
        min={1}
        max={MAX_SEC}
        step={1}
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          const n = parseFloat(raw);
          if (Number.isFinite(n)) onChange(clampSec(n));
        }}
        onBlur={() => setText(String(value))}
        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/25 focus:bg-white/10"
      />
    </label>
  );
}
