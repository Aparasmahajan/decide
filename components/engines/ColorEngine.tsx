"use client";

import { motion, useMotionValue, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory } from "@/lib/storage";
import { Copy } from "lucide-react";

type Mode = "hex" | "gradient";
type HSL = { h: number; s: number; l: number };

/* The roll: this many random swatches, one every TICK_MS, then the result. */
const ROLL_TICKS = 12;
const TICK_MS = 90;
/* How long the landed swatch takes to settle in. */
const SETTLE_MS = 400;

/*
 * The first paint is fixed (brand violet → sky). Seeding state with
 * `rndColor()` rendered one colour on the server and a different one on the
 * client, so every load was a hydration mismatch on the swatch and its text.
 */
const START: [HSL, HSL] = [
  { h: 258, s: 85, l: 62 },
  { h: 198, s: 88, l: 56 },
];

function rndColor(): HSL {
  const h = Math.floor(Math.random() * 360);
  const s = 60 + Math.floor(Math.random() * 30);
  const l = 45 + Math.floor(Math.random() * 20);
  return { h, s, l };
}

function hsl({ h, s, l }: HSL) {
  return `hsl(${h} ${s}% ${l}%)`;
}

function hexFromHsl({ h, s, l }: HSL) {
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

function rgbFromHsl(c: HSL) {
  const hex = hexFromHsl(c);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

const swatch = (m: Mode, a: HSL, b: HSL) =>
  m === "hex" ? hsl(a) : `linear-gradient(135deg, ${hsl(a)}, ${hsl(b)})`;

const caption = (m: Mode, a: HSL, b: HSL) =>
  m === "hex" ? hexFromHsl(a) : `${hexFromHsl(a)} → ${hexFromHsl(b)}`;

export default function ColorEngine({ engine }: { engine: EngineDef }) {
  const [mode, setMode] = useState<Mode>("hex");
  const [c1, setC1] = useState<HSL>(START[0]);
  const [c2, setC2] = useState<HSL>(START[1]);
  const [rolling, setRolling] = useState(false);
  const [copied, setCopied] = useState("");
  const reduce = useReducedMotion();
  const swatchRef = useRef<HTMLDivElement>(null);
  const rollRef = useRef<number | null>(null);
  const copyRef = useRef<number | null>(null);
  // Read when the roll lands, so switching mode mid-roll records what's shown.
  const modeRef = useRef<Mode>(mode);

  /*
   * The swatch and its caption are motion values. The roll used to set state
   * every 90ms *and* re-key the swatch on every colour, so each tick re-rendered
   * the whole engine and threw away and rebuilt a 448px element carrying a
   * two-layer 120px glow, restarting its fade-in each time — it never finished
   * one, which is why the swatch pulsed dim while mixing. Now a tick is two
   * style/text writes, and the side panel only re-renders for the result.
   */
  const bg = useMotionValue(swatch("hex", START[0], START[1]));
  const label = useMotionValue(caption("hex", START[0], START[1]));
  const paint = (m: Mode, a: HSL, b: HSL) => {
    bg.set(swatch(m, a, b));
    label.set(caption(m, a, b));
  };

  useEffect(
    () => () => {
      if (rollRef.current !== null) clearInterval(rollRef.current);
      if (copyRef.current !== null) clearTimeout(copyRef.current);
    },
    [],
  );

  const changeMode = (m: Mode) => {
    setMode(m);
    modeRef.current = m;
    if (!rolling) paint(m, c1, c2);
  };

  const generate = () => {
    if (rolling) return;
    const f1 = rndColor();
    const f2 = rndColor();

    const land = () => {
      rollRef.current = null;
      paint(modeRef.current, f1, f2);
      // One compositor-run settle for the result (the old fade-in, once).
      if (!reduce) {
        swatchRef.current?.animate?.(
          [
            { transform: "scale(0.98)", opacity: 0.6 },
            { transform: "scale(1)", opacity: 1 },
          ],
          { duration: SETTLE_MS, easing: "ease-out" },
        );
      }
      setC1(f1);
      setC2(f2);
      setRolling(false);
      pushHistory({
        engineId: engine.slug,
        outcome: caption(modeRef.current, f1, f2),
      });
    };

    // A dozen full-swatch colour changes a second is exactly the kind of
    // flashing reduced motion asks us not to do; just show the result.
    if (reduce) return land();

    setRolling(true);
    let ticks = 0;
    rollRef.current = window.setInterval(() => {
      ticks++;
      if (ticks > ROLL_TICKS) {
        if (rollRef.current !== null) clearInterval(rollRef.current);
        land();
        return;
      }
      paint(modeRef.current, rndColor(), rndColor());
    }, TICK_MS);
  };

  const copy = async (id: string, text: string) => {
    try {
      // Throws (or rejects) without permission or outside a secure context;
      // only claim "Copied" when it actually was.
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(id);
    if (copyRef.current !== null) clearTimeout(copyRef.current);
    copyRef.current = window.setTimeout(() => setCopied(""), 1200);
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
                  onClick={() => changeMode(m)}
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
            <ValueRow id="hex1" label="HEX" value={hexFromHsl(c1)} onCopy={copy} copied={copied} />
            <ValueRow id="rgb1" label="RGB" value={rgbFromHsl(c1)} onCopy={copy} copied={copied} />
            <ValueRow id="hsl1" label="HSL" value={hsl(c1)} onCopy={copy} copied={copied} />
            {mode === "gradient" && (
              <>
                <div className="mt-3 border-t border-white/5 pt-3">
                  <p className="mb-2 text-[11px] uppercase tracking-widest text-white/40">
                    Stop 2
                  </p>
                  <ValueRow id="hex2" label="HEX" value={hexFromHsl(c2)} onCopy={copy} copied={copied} />
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
            ref={swatchRef}
            initial={{ scale: 0.98, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: SETTLE_MS / 1000, ease: "easeOut" }}
            className="relative aspect-square w-full max-w-md rounded-3xl shadow-glow-lg"
            style={{ background: bg }}
          >
            {/*
              No backdrop blur on the caption. Blurring a flat colour or a
              smooth gradient produces the same colour, so the blur was
              invisible — but it still re-sampled and re-blurred the swatch
              behind it on every colour change. A touch more tint keeps the
              text's contrast without it.
            */}
            <div className="absolute inset-x-6 bottom-6 rounded-2xl bg-black/45 px-5 py-3 text-white">
              <div className="text-[11px] uppercase tracking-widest opacity-80">
                {mode === "hex" ? "HEX" : "Gradient"}
              </div>
              <motion.div className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
                {label}
              </motion.div>
            </div>
          </motion.div>
          <span className="sr-only" aria-live="polite">
            {rolling ? "" : caption(mode, c1, c2)}
          </span>
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
  id,
  label,
  value,
  onCopy,
  copied,
}: {
  id: string;
  label: string;
  value: string;
  onCopy: (id: string, v: string) => void;
  copied: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10">
      <span className="text-[10px] uppercase tracking-widest text-white/50">
        {label}
      </span>
      <span className="flex-1 truncate font-mono text-white">{value}</span>
      <button
        onClick={() => onCopy(id, value)}
        aria-label={`Copy ${label} ${value}`}
        className="grid h-7 w-7 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      {copied === id && (
        <span className="text-[10px] text-emerald-300">Copied</span>
      )}
    </div>
  );
}
