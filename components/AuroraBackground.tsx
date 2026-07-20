"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

type Props = {
  intensity?: number;
  variant?: "default" | "warm" | "cool" | "aurora";
};

export default function AuroraBackground({
  intensity = 1,
  variant = "default",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth) * 100;
        const y = (e.clientY / window.innerHeight) * 100;
        el.style.setProperty("--mx", `${x}%`);
        el.style.setProperty("--my", `${y}%`);
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  const palette =
    variant === "warm"
      ? ["#f97316", "#f472b6", "#facc15"]
      : variant === "cool"
        ? ["#38bdf8", "#8b5cf6", "#22d3ee"]
        : variant === "aurora"
          ? ["#22c55e", "#38bdf8", "#a855f7"]
          : ["#8b5cf6", "#38bdf8", "#f472b6"];

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      aria-hidden
      style={
        {
          ["--mx" as string]: "50%",
          ["--my" as string]: "50%",
        } as React.CSSProperties
      }
    >
      {/* Mouse follow spotlight */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(600px 400px at var(--mx) var(--my), rgba(139,92,246,${
            0.18 * intensity
          }), transparent 60%)`,
          transition: "background 400ms ease",
        }}
      />
      {/* Aurora blobs */}
      <motion.div
        className="aurora"
        style={{
          width: 700,
          height: 700,
          left: "-10%",
          top: "-10%",
          background: `radial-gradient(circle, ${palette[0]} 0%, transparent 60%)`,
        }}
        animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="aurora"
        style={{
          width: 620,
          height: 620,
          right: "-8%",
          top: "10%",
          background: `radial-gradient(circle, ${palette[1]} 0%, transparent 60%)`,
        }}
        animate={{ x: [0, -30, 20, 0], y: [0, 20, -20, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="aurora"
        style={{
          width: 560,
          height: 560,
          left: "20%",
          bottom: "-15%",
          background: `radial-gradient(circle, ${palette[2]} 0%, transparent 60%)`,
        }}
        animate={{ x: [0, 30, -30, 0], y: [0, -20, 20, 0] }}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Grid overlay */}
      <div className="absolute inset-0 dot-grid opacity-40" />
      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(4,5,31,0.6) 100%)",
        }}
      />
    </div>
  );
}
