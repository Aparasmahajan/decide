"use client";

import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";
import type { EngineDef } from "@/lib/engines";
import { cn } from "@/lib/cn";
import { ArrowUpRight, Lock } from "lucide-react";

type Props = { engine: EngineDef; index: number };

export default function EngineTile({ engine, index }: Props) {
  const ref = useRef<HTMLAnchorElement>(null);

  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rxs = useSpring(rx, { stiffness: 220, damping: 20 });
  const rys = useSpring(ry, { stiffness: 220, damping: 20 });

  const glareX = useTransform(rys, [-8, 8], ["20%", "80%"]);
  const glareY = useTransform(rxs, [-8, 8], ["80%", "20%"]);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const px = x / rect.width - 0.5;
    const py = y / rect.height - 0.5;
    ry.set(px * 12);
    rx.set(-py * 12);
  };

  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  const soon = engine.status === "soon";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.55,
        delay: Math.min(index * 0.03, 0.4),
        ease: [0.22, 0.9, 0.28, 1],
      }}
      style={{ perspective: 1200 }}
    >
      <Link
        ref={ref}
        href={soon ? "#" : `/engine/${engine.slug}`}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className={cn(
          "group relative block h-full overflow-hidden rounded-3xl border border-white/10 p-5 sm:p-6",
          "transition-shadow duration-500 hover:shadow-glow-lg",
          soon && "cursor-not-allowed",
        )}
      >
        <motion.div
          style={{
            rotateX: rxs,
            rotateY: rys,
            transformStyle: "preserve-3d",
          }}
          className="relative h-full"
        >
          {/* Gradient background */}
          <div
            className="absolute inset-0 -z-10 opacity-70 transition-opacity duration-500 group-hover:opacity-90"
            style={{
              background: `radial-gradient(120% 100% at 0% 0%, ${engine.color}33 0%, transparent 60%), radial-gradient(120% 100% at 100% 100%, ${engine.color2}33 0%, transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)`,
            }}
          />
          <div className="absolute inset-0 -z-10 backdrop-blur-xl" />
          {/* Glare */}
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: `radial-gradient(400px 200px at ${glareX} ${glareY}, rgba(255,255,255,0.15), transparent 60%)`,
            }}
          />
          {/* Content */}
          <div className="flex h-full flex-col justify-between gap-6">
            <div className="flex items-start justify-between">
              <motion.div
                className="grid h-14 w-14 place-items-center rounded-2xl text-3xl shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
                style={{
                  background: `linear-gradient(135deg, ${engine.color}, ${engine.color2})`,
                  transform: "translateZ(40px)",
                }}
                whileHover={{ scale: 1.06, rotate: -4 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <span className="drop-shadow-sm">{engine.emoji}</span>
              </motion.div>
              <div
                className="flex items-center gap-1 text-xs text-white/40"
                style={{ transform: "translateZ(20px)" }}
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

            <div style={{ transform: "translateZ(30px)" }}>
              <h3 className="text-[17px] font-semibold tracking-tight text-white">
                {engine.name}
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-white/55">
                {engine.tagline}
              </p>
            </div>
          </div>

          {/* Border glow */}
          <div
            className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{
              boxShadow: `0 0 0 1px ${engine.color}55, 0 20px 60px -20px ${engine.color2}66`,
            }}
          />
        </motion.div>
      </Link>
    </motion.div>
  );
}
