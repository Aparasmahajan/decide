"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

type Props = {
  intensity?: number;
  variant?: "default" | "warm" | "cool" | "aurora";
  interactive?: boolean;
};

/**
 * Ambient animated background.
 *
 * Perf notes:
 * - The mouse-follow spotlight is a fixed-size gradient div that we translate on the GPU
 *   (transform-only mutation, no paint) — the previous version rewrote the `background`
 *   property every frame, which forced a large paint.
 * - Aurora blobs use `filter: blur(...)` at 60px (was 80) — big blurs are expensive.
 * - Skips animation and mouse tracking under `prefers-reduced-motion`.
 */
export default function AuroraBackground({
  intensity = 1,
  variant = "default",
  interactive = true,
}: Props) {
  const spotlightRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!interactive || reduce) return;
    const el = spotlightRef.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      if (rafRef.current !== null) return;
      const x = e.clientX;
      const y = e.clientY;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        // translate3d keeps this on the compositor (no paint, no layout).
        el.style.transform = `translate3d(${x - 300}px, ${y - 200}px, 0)`;
      });
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [interactive, reduce]);

  const palette =
    variant === "warm"
      ? ["#f97316", "#f472b6", "#facc15"]
      : variant === "cool"
        ? ["#38bdf8", "#8b5cf6", "#22d3ee"]
        : variant === "aurora"
          ? ["#22c55e", "#38bdf8", "#a855f7"]
          : ["#8b5cf6", "#38bdf8", "#f472b6"];

  const anim = reduce ? undefined : true;

  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      {/* Mouse-follow spotlight — translate-only, GPU composited. */}
      {interactive && !reduce && (
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
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 640,
          height: 640,
          left: "-8%",
          top: "-12%",
          filter: "blur(60px)",
          opacity: 0.55,
          background: `radial-gradient(closest-side, ${palette[0]}, transparent 70%)`,
          mixBlendMode: "screen",
        }}
        animate={
          anim ? { x: [0, 30, -20, 0], y: [0, -20, 20, 0] } : undefined
        }
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 560,
          height: 560,
          right: "-6%",
          top: "8%",
          filter: "blur(60px)",
          opacity: 0.5,
          background: `radial-gradient(closest-side, ${palette[1]}, transparent 70%)`,
          mixBlendMode: "screen",
        }}
        animate={
          anim ? { x: [0, -25, 15, 0], y: [0, 15, -20, 0] } : undefined
        }
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 520,
          height: 520,
          left: "18%",
          bottom: "-14%",
          filter: "blur(60px)",
          opacity: 0.45,
          background: `radial-gradient(closest-side, ${palette[2]}, transparent 70%)`,
          mixBlendMode: "screen",
        }}
        animate={
          anim ? { x: [0, 25, -25, 0], y: [0, -15, 15, 0] } : undefined
        }
        transition={{ duration: 34, repeat: Infinity, ease: "easeInOut" }}
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
