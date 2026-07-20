"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory } from "@/lib/storage";
import { Copy } from "lucide-react";

type Mode = "hex" | "gradient";

function rndColor() {
  const h = Math.floor(Math.random() * 360);
  const s = 60 + Math.floor(Math.random() * 30);
  const l = 45 + Math.floor(Math.random() * 20);
  return { h, s, l };
}

function hsl({ h, s, l }: { h: number; s: number; l: number }) {
  return `hsl(${h} ${s}% ${l}%)`;
}

function hexFromHsl({ h, s, l }: { h: number; s: number; l: number }) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

function rgbFromHsl(c: { h: number; s: number; l: number }) {
  const hex = hexFromHsl(c);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

export default function ColorEngine({ engine }: { engine: EngineDef }) {
  const [mode, setMode] = useState<Mode>("hex");
  const [c1, setC1] = useState(rndColor());
  const [c2, setC2] = useState(rndColor());
  const [rolling, setRolling] = useState(false);
  const [copied, setCopied] = useState("");

  const generate = () => {
    if (rolling) return;
    setRolling(true);
    let ticks = 0;
    const iv = setInterval(() => {
      setC1(rndColor());
      setC2(rndColor());
      ticks++;
      if (ticks > 12) {
        clearInterval(iv);
        const f1 = rndColor();
        const f2 = rndColor();
        setC1(f1);
        setC2(f2);
        setRolling(false);
        pushHistory({
          engineId: engine.slug,
          outcome:
            mode === "hex"
              ? hexFromHsl(f1)
              : `${hexFromHsl(f1)} → ${hexFromHsl(f2)}`,
        });
      }
    }, 90);
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(""), 1200);
  };

  return (
    <EngineShell
      engine={engine}
      variant="warm"
      side={
        <>
          <SidePanel title="Mode">
            <div className="grid grid-cols-2 gap-2">
              {(["hex", "gradient"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={
                    "rounded-xl px-3 py-2 text-sm capitalize transition-all " +
                    (mode === m
                      ? "bg-white text-ink-950 shadow-glow"
                      : "bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white")
                  }
                >
                  {m}
                </button>
              ))}
            </div>
          </SidePanel>
          <SidePanel title="Values">
            <ValueRow label="HEX" value={hexFromHsl(c1)} onCopy={copy} copied={copied} />
            <ValueRow label="RGB" value={rgbFromHsl(c1)} onCopy={copy} copied={copied} />
            <ValueRow label="HSL" value={hsl(c1)} onCopy={copy} copied={copied} />
            {mode === "gradient" && (
              <>
                <div className="mt-3 border-t border-white/5 pt-3">
                  <p className="mb-2 text-[11px] uppercase tracking-widest text-white/40">
                    Stop 2
                  </p>
                  <ValueRow label="HEX" value={hexFromHsl(c2)} onCopy={copy} copied={copied} />
                </div>
              </>
            )}
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
          Color of the moment
        </p>
        <div className="grid flex-1 w-full place-items-center">
          <motion.div
            key={`${hexFromHsl(c1)}${hexFromHsl(c2)}`}
            initial={{ scale: 0.98, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="relative aspect-square w-full max-w-md rounded-3xl shadow-glow-lg"
            style={{
              background:
                mode === "hex"
                  ? hsl(c1)
                  : `linear-gradient(135deg, ${hsl(c1)}, ${hsl(c2)})`,
            }}
          >
            <div className="absolute inset-x-6 bottom-6 rounded-2xl bg-black/40 px-5 py-3 text-white backdrop-blur-md">
              <div className="text-[11px] uppercase tracking-widest opacity-70">
                {mode === "hex" ? "HEX" : "Gradient"}
              </div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">
                {mode === "hex"
                  ? hexFromHsl(c1)
                  : `${hexFromHsl(c1)} → ${hexFromHsl(c2)}`}
              </div>
            </div>
          </motion.div>
        </div>
        <BigActionButton
          label={rolling ? "Mixing…" : "New color"}
          onClick={generate}
          disabled={rolling}
          color="#ec4899"
          color2="#facc15"
        />
      </div>
    </EngineShell>
  );
}

function ValueRow({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy: (v: string) => void;
  copied: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10">
      <span className="text-[10px] uppercase tracking-widest text-white/50">
        {label}
      </span>
      <span className="flex-1 truncate font-mono text-white">{value}</span>
      <button
        onClick={() => onCopy(value)}
        className="grid h-7 w-7 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      {copied === value && (
        <span className="text-[10px] text-emerald-300">Copied</span>
      )}
    </div>
  );
}
