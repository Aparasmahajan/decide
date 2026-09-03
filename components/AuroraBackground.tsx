"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  intensity?: number;
  variant?: "default" | "warm" | "cool" | "aurora";
  interactive?: boolean;
};

const PALETTES = {
  warm: ["#f97316", "#f472b6", "#facc15"],
  cool: ["#38bdf8", "#8b5cf6", "#22d3ee"],
  aurora: ["#22c55e", "#38bdf8", "#a855f7"],
  default: ["#8b5cf6", "#38bdf8", "#f472b6"],
} as const;

/**
 * Ambient animated background.
 *
 * Perf notes:
 * - The whole layer is `fixed`, not `absolute`. As an absolute child of a tall
 *   page this element was as tall as the document (several thousand px on the
 *   home page), so the compositor had to allocate and rasterize blurred layers
 *   across the entire scroll height. Fixed pins it to the viewport — the layer
 *   is now a constant ~1 screen no matter how long the page is.
 * - Blob drift is pure CSS keyframes (see `.aurora-blob` in globals.css), so it
 *   runs on the compositor thread. Previously three framer-motion springs ticked
 *   on the main thread for the entire lifetime of every page.
 * - The mouse-follow spotlight translates on the GPU (transform-only, no paint)
 *   and is mounted lazily on first pointer movement, so touch devices never pay
 *   for it at all.
 * - Skips animation and pointer tracking under `prefers-reduced-motion`.
 */
export default function AuroraBackground({
  intensity = 1,
  variant = "default",
  interactive = true,
}: Props) {
  const spotlightRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [reduce, setReduce] = useState(true);
  const [spotlightOn, setSpotlightOn] = useState(false);

  // Read the preference on the client only, so SSR markup stays deterministic.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!interactive || reduce) return;

    const onMove = (e: MouseEvent) => {
      // A fine pointer is present — only now is the spotlight layer worth having.
      if (!spotlightOn) setSpotlightOn(true);
      if (rafRef.current !== null) return;
      const x = e.clientX;
      const y = e.clientY;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const el = spotlightRef.current;
        // translate3d keeps this on the compositor (no paint, no layout).
        if (el) el.style.transform = `translate3d(${x - 300}px, ${y - 200}px, 0)`;
      });
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [interactive, reduce, spotlightOn]);

  const palette = PALETTES[variant] ?? PALETTES.default;

  const blob = (
    color: string,
    size: number,
    pos: React.CSSProperties,
    opacity: number,
    keyframes: string,
    duration: number,
  ): React.CSSProperties => ({
    ...pos,
    width: size,
    height: size,
    opacity,
    background: `radial-gradient(closest-side, ${color}, transparent 70%)`,
    animationName: reduce ? "none" : keyframes,
    animationDuration: `${duration}s`,
  });

  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      {/* Mouse-follow spotlight — translate-only, GPU composited. */}
      {interactive && !reduce && spotlightOn && (
        <div
          ref={spotlightRef}
          className="absolute h-[400px] w-[600px] will-change-transform"
          style={{
            background: `radial-gradient(closest-side, rgba(139,92,246,${
              0.18 * intensity
            }), transparent 70%)`,
            transform: "translate3d(-9999px, -9999px, 0)",
          }}
        />
      )}

      {/* Aurora blobs — three is plenty; larger blur costs a lot per pixel. */}
      <div
        className="aurora-blob"
        style={blob(
          palette[0],
          640,
          { left: "-8%", top: "-12%" },
          0.55,
          "aurora-drift-a",
          26,
        )}
      />
      <div
        className="aurora-blob"
        style={blob(
          palette[1],
          560,
          { right: "-6%", top: "8%" },
          0.5,
          "aurora-drift-b",
          30,
        )}
      />
      <div
        className="aurora-blob"
        style={blob(
          palette[2],
          520,
          { left: "18%", bottom: "-14%" },
          0.45,
          "aurora-drift-c",
          34,
        )}
      />

      {/* Grid overlay (cheap paint, no filter). */}
      <div className="absolute inset-0 dot-grid opacity-40" />

      {/* Vignette (cheap radial gradient, no blur). */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(4,5,31,0.55) 100%)",
        }}
      />
    </div>
  );
}
