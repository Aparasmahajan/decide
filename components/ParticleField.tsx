"use client";

import { memo, useMemo } from "react";

type Props = {
  count?: number;
  color?: string;
  speed?: number;
  className?: string;
};

const DRIFTS = [
  "particle-drift-a",
  "particle-drift-b",
  "particle-drift-c",
  "particle-drift-d",
];

/** Small deterministic PRNG, so the server and client render identical dots. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Cheap ambient particles.
 *
 * Perf notes:
 * - This used to be a viewport-sized <canvas> cleared and redrawn from a rAF
 *   loop. Even with the draw itself batched, the browser then had to upload the
 *   whole viewport-sized canvas to the GPU again on *every* frame — megabytes per
 *   frame, forever, on the main thread — which is what animations on top of it
 *   (coin flips, wheel spins) were fighting for time against.
 * - Each dot is now a tiny element on a CSS keyframe that only touches
 *   transform and opacity, so the compositor runs the whole field without the
 *   main thread or any repaint. The browser stops servicing it when the tab is
 *   hidden, and the global reduced-motion rule freezes it.
 * - Positions come from a seeded PRNG rather than Math.random, so the SSR
 *   markup matches the client and there's no hydration mismatch.
 */
function ParticleField({
  count = 40,
  color = "255,255,255",
  speed = 0.35,
  className,
}: Props) {
  const dots = useMemo(() => {
    const rand = mulberry32(count * 7919 + 17);
    // `speed` keeps its old meaning: higher is livelier.
    const pace = 0.35 / Math.max(0.05, speed);
    return Array.from({ length: count }, (_, i) => {
      const size = rand() * 2.8 + 0.8;
      const duration = (14 + rand() * 18) * pace;
      return {
        left: `${(rand() * 100).toFixed(2)}%`,
        top: `${(rand() * 100).toFixed(2)}%`,
        size,
        alpha: (0.2 + rand() * 0.5).toFixed(2),
        animationName: DRIFTS[i % DRIFTS.length],
        animationDuration: `${duration.toFixed(1)}s`,
        // Negative delay starts each dot part-way through its cycle.
        animationDelay: `${(-rand() * duration).toFixed(1)}s`,
      };
    });
  }, [count, speed]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${className ?? ""}`}
    >
      {dots.map((d, i) => (
        <span
          key={i}
          className="particle"
          style={{
            left: d.left,
            top: d.top,
            width: d.size,
            height: d.size,
            background: `rgba(${color},${d.alpha})`,
            animationName: d.animationName,
            animationDuration: d.animationDuration,
            animationDelay: d.animationDelay,
          }}
        />
      ))}
    </div>
  );
}

export default memo(ParticleField);
