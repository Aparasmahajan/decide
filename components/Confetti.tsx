"use client";

import { useEffect, useRef } from "react";

type Props = {
  /** Number of pieces. Kept modest — canvas is cheap but not free. */
  count?: number;
  /** How long the burst runs, in ms. */
  duration?: number;
};

/**
 * A celebratory burst, drawn on a single canvas.
 *
 * The DOM version of this spawned one animated element per piece — 90 elements,
 * each with its own animation driver, its own compositor layer and a `box-shadow`
 * glow that had to repaint as the piece moved. That reliably dropped frames at
 * exactly the moment the user was looking at the result.
 *
 * One canvas is one layer and one draw call per frame regardless of piece count,
 * and the physics is a handful of adds per piece. Respects reduced motion.
 */
export default function Confetti({ count = 90, duration = 2400 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = window.innerWidth;
    let h = window.innerHeight;

    const size = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();

    type Piece = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      rot: number;
      vr: number;
      w: number;
      h: number;
      color: string;
      delay: number;
    };

    const pieces: Piece[] = Array.from({ length: count }, () => {
      const s = 6 + Math.random() * 8;
      return {
        x: Math.random() * w,
        y: -40 - Math.random() * 80,
        vx: (Math.random() - 0.5) * 1.6,
        vy: 2.5 + Math.random() * 2.5,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
        w: s,
        h: s * 0.4,
        color: `hsl(${Math.floor(Math.random() * 360)} 90% 65%)`,
        delay: Math.random() * 400,
      };
    });

    let raf = 0;
    let start = 0;

    const frame = (now: number) => {
      if (!start) start = now;
      const elapsed = now - start;
      // Fade the whole burst out over its final third.
      const fade = Math.min(1, Math.max(0, (duration - elapsed) / (duration / 3)));

      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = fade;

      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        if (elapsed < p.delay) continue;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.03; // gravity
        p.rot += p.vr;
        if (p.y > h + 40) continue;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      ctx.globalAlpha = 1;
      if (elapsed < duration) raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    window.addEventListener("resize", size, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
    };
  }, [count, duration]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50"
    />
  );
}
