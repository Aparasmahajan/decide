"use client";

import { useEffect, useRef } from "react";

type Props = {
  count?: number;
  color?: string;
  speed?: number;
  className?: string;
};

/** Alpha buckets — see the draw loop for why. */
const ALPHA_STEPS = 4;

/**
 * Cheap ambient particles.
 *
 * Perf notes:
 * - The canvas is viewport-sized and `fixed`. It used to size itself to its
 *   parent, which on a long page (the home grid is several thousand px tall)
 *   meant clearing and redrawing a canvas many times larger than anything the
 *   user could see — by far the most expensive thing on the page.
 * - Device pixel ratio is pinned to 1. These are 1-2px blurred dots; there is
 *   nothing for extra pixels to resolve, and dropping from 1.5 to 1 cuts the
 *   fill cost by ~2.25x on retina.
 * - Particles are bucketed into a few alpha levels so the whole field draws in
 *   ALPHA_STEPS fill() calls instead of one per particle. `globalAlpha` changes
 *   flush canvas state, so per-particle alpha was forcing N state changes and N
 *   draw calls every frame.
 * - Pauses when the tab is hidden or the canvas is off-screen.
 * - Skips entirely when the user prefers reduced motion.
 */
export default function ParticleField({
  count = 40,
  color = "255,255,255",
  speed = 0.35,
  className,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // `desynchronized` lets the browser skip a compositing round-trip for this
    // purely decorative overlay.
    const ctx = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let running = false;
    let onScreen = true;

    type P = { x: number; y: number; vx: number; vy: number; r: number; b: number };
    // Particles grouped by alpha bucket so each bucket is one path + one fill.
    const buckets: P[][] = Array.from({ length: ALPHA_STEPS }, () => []);
    let seeded = false;

    const seed = () => {
      for (const b of buckets) b.length = 0;
      for (let i = 0; i < count; i++) {
        const b = Math.floor(Math.random() * ALPHA_STEPS);
        buckets[b].push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * speed,
          vy: (Math.random() - 0.5) * speed,
          r: Math.random() * 1.4 + 0.4,
          b,
        });
      }
      seeded = true;
    };

    const resize = () => {
      const nw = window.innerWidth;
      const nh = window.innerHeight;
      if (nw === w && nh === h) return;
      const hadSize = w > 0 && h > 0;
      w = nw;
      h = nh;
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.fillStyle = `rgb(${color})`;
      if (!seeded) seed();
      else if (hadSize) {
        // Keep existing particles but pull strays back inside the new bounds.
        for (const bucket of buckets) {
          for (const p of bucket) {
            if (p.x > w) p.x = Math.random() * w;
            if (p.y > h) p.y = Math.random() * h;
          }
        }
      }
    };

    const step = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (let bi = 0; bi < ALPHA_STEPS; bi++) {
        const bucket = buckets[bi];
        if (bucket.length === 0) continue;
        // Bucket 0 -> 0.2 alpha, last bucket -> ~0.7.
        ctx.globalAlpha = 0.2 + (bi / ALPHA_STEPS) * 0.5;
        ctx.beginPath();
        for (let i = 0; i < bucket.length; i++) {
          const p = bucket[i];
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -10) p.x = w + 10;
          else if (p.x > w + 10) p.x = -10;
          if (p.y < -10) p.y = h + 10;
          else if (p.y > h + 10) p.y = -10;
          ctx.moveTo(p.x + p.r, p.y);
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(step);
    };

    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(step);
    };

    const stop = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const sync = () => {
      if (document.hidden || !onScreen) stop();
      else start();
    };

    resize();

    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    io.observe(canvas);

    // Coalesce resize storms into one rAF-aligned measurement.
    let resizeRaf = 0;
    const onResize = () => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        resize();
      });
    };

    document.addEventListener("visibilitychange", sync);
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("resize", onResize);
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      stop();
    };
  }, [count, color, speed]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`pointer-events-none fixed inset-0 -z-10 ${className ?? ""}`}
    />
  );
}
