"use client";

import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { memo, useRef, useState } from "react";
import type { EngineDef } from "@/lib/engines";
import { cn } from "@/lib/cn";
import { ArrowUpRight, Lock } from "lucide-react";

type Props = { engine: EngineDef; index: number };

function EngineTile({ engine, index }: Props) {
  const ref = useRef<HTMLAnchorElement>(null);
  const rafRef = useRef<number | null>(null);
  const hoveredRef = useRef(false);
  // Drives `will-change` only while the tilt is actually live. Leaving
  // `will-change: transform` on permanently pinned a GPU layer for every tile
  // in the grid — 26 layers' worth of texture memory, allocated up front and
  // never released, which is exactly the kind of thing that makes scrolling
  // feel heavy on integrated graphics.
  const [tilting, setTilting] = useState(false);

  // Motion values drive CSS transform on the GPU without React re-renders.
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rxs = useSpring(rx, { stiffness: 260, damping: 26, mass: 0.6 });
  const rys = useSpring(ry, { stiffness: 260, damping: 26, mass: 0.6 });
  const glareX = useTransform(rys, [-8, 8], ["20%", "80%"]);
  const glareY = useTransform(rxs, [-8, 8], ["80%", "20%"]);

  const onEnter = () => {
    hoveredRef.current = true;
    setTilting(true);
  };

  const onMove = (e: React.MouseEvent) => {
    if (!hoveredRef.current) return;
    if (rafRef.current !== null) return;
    const el = ref.current;
    if (!el) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const rect = el.getBoundingClientRect();
      const px = (clientX - rect.left) / rect.width - 0.5;
      const py = (clientY - rect.top) / rect.height - 0.5;
      ry.set(px * 10);
      rx.set(-py * 10);
    });
  };

  const onLeave = () => {
    hoveredRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    rx.set(0);
    ry.set(0);
    // Hold the layer just long enough for the spring to settle back to flat.
    window.setTimeout(() => {
      if (!hoveredRef.current) setTilting(false);
    }, 400);
  };

  const soon = engine.status === "soon";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: 0.5,
        delay: Math.min(index * 0.025, 0.35),
        ease: [0.22, 0.9, 0.28, 1],
      }}
      className="tile-wrapper"
    >
      <Link
        ref={ref}
        href={soon ? "#" : `/engine/${engine.slug}`}
        onMouseEnter={onEnter}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className={cn(
          "group relative block h-full overflow-hidden rounded-3xl border border-white/10 p-5 sm:p-6",
          "bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))]",
          "transition-[transform,box-shadow] duration-500 hover:shadow-glow",
          soon && "cursor-not-allowed",
        )}
        style={{
          // Establish 3D context on the anchor itself — cheaper than nested transform-style.
          perspective: 1000,
        }}
      >
        {/* Static gradient overlay — no backdrop-filter, pure paint. */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden
          style={{
            background: `radial-gradient(120% 100% at 0% 0%, ${engine.color}22 0%, transparent 55%), radial-gradient(120% 100% at 100% 100%, ${engine.color2}22 0%, transparent 55%)`,
          }}
        />

        <motion.div
          style={{
            rotateX: rxs,
            rotateY: rys,
            transformStyle: "preserve-3d",
            willChange: tilting ? "transform" : undefined,
          }}
          className="relative h-full"
        >
          {/* Glare — mounted only while hovered, so the gradient it repaints as
              the pointer moves does not exist for the other 25 tiles. */}
          {tilting && (
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background: `radial-gradient(300px 180px at ${glareX} ${glareY}, rgba(255,255,255,0.14), transparent 60%)`,
              }}
            />
          )}

          <div className="flex h-full flex-col justify-between gap-6">
            <div className="flex items-start justify-between">
              <div
                className="grid h-14 w-14 place-items-center rounded-2xl text-3xl shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3"
                style={{
                  background: `linear-gradient(135deg, ${engine.color}, ${engine.color2})`,
                  transform: "translateZ(30px)",
                }}
              >
                <span>{engine.emoji}</span>
              </div>
              <div
                className="flex items-center gap-1 text-xs text-white/40"
                style={{ transform: "translateZ(16px)" }}
              >
                {soon ? (
                  <span className="chip">
                    <Lock className="h-3 w-3" /> Soon
                  </span>
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-white/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                )}
              </div>
            </div>

            <div style={{ transform: "translateZ(20px)" }}>
              <h3 className="text-[17px] font-semibold tracking-tight text-white">
                {engine.name}
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-white/55">
                {engine.tagline}
              </p>
            </div>
          </div>

          {/* Border glow — cheap, only visible on hover. */}
          <div
            className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{
              boxShadow: `0 0 0 1px ${engine.color}44, 0 16px 40px -20px ${engine.color2}66`,
            }}
          />
        </motion.div>
      </Link>
    </motion.div>
  );
}

/*
 * The grid re-renders on every keystroke in the search box. Without memo, all
 * matching tiles rebuild their subtree each time even though `engine` is a
 * stable object from the ENGINES constant and only the *set* of tiles changed.
 */
export default memo(EngineTile);
