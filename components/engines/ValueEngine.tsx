"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import EngineShell, {
  BigActionButton,
  SidePanel,
} from "@/components/EngineShell";
import type { EngineDef } from "@/lib/engines";
import { pushHistory, readConfig, writeConfig } from "@/lib/storage";
import { Plus, Trash2, Crown, TrendingDown } from "lucide-react";

/* ------------------------------------------------------------------ *
 * Units
 *
 * Every comparison happens inside one family so we never have to guess
 * whether "2" means 2 kg or 2 litres. Within a family each unit declares
 * how many base units it is worth, and all maths runs in base units.
 * ------------------------------------------------------------------ */

type FamilyKey = "weight" | "volume" | "length" | "count";

type Family = {
  name: string;
  /** Unit every quantity is normalised to. */
  base: string;
  units: { key: string; label: string; factor: number }[];
  /** A friendlier chunk to quote the headline price in (₹/100g reads better than ₹/g). */
  display: { label: string; factor: number };
};

const FAMILIES: Record<FamilyKey, Family> = {
  weight: {
    name: "Weight",
    base: "g",
    units: [
      { key: "mg", label: "mg", factor: 0.001 },
      { key: "g", label: "g", factor: 1 },
      { key: "kg", label: "kg", factor: 1000 },
      { key: "oz", label: "oz", factor: 28.349523125 },
      { key: "lb", label: "lb", factor: 453.59237 },
    ],
    display: { label: "100 g", factor: 100 },
  },
  volume: {
    name: "Volume",
    base: "ml",
    units: [
      { key: "ml", label: "ml", factor: 1 },
      { key: "L", label: "L", factor: 1000 },
      { key: "floz", label: "fl oz", factor: 29.5735295625 },
      { key: "gal", label: "gal", factor: 3785.411784 },
    ],
    display: { label: "100 ml", factor: 100 },
  },
  length: {
    name: "Length",
    base: "cm",
    units: [
      { key: "cm", label: "cm", factor: 1 },
      { key: "m", label: "m", factor: 100 },
      { key: "in", label: "in", factor: 2.54 },
      { key: "ft", label: "ft", factor: 30.48 },
    ],
    display: { label: "metre", factor: 100 },
  },
  count: {
    name: "Count",
    base: "pc",
    units: [
      { key: "pc", label: "pc", factor: 1 },
      { key: "pair", label: "pair", factor: 2 },
      { key: "dozen", label: "dozen", factor: 12 },
    ],
    display: { label: "piece", factor: 1 },
  },
};

const CURRENCIES = ["₹", "$", "€", "£", "¥"];

/*
 * Price and quantity are held as strings, not numbers. Binding a number
 * straight to an <input type="number"> makes intermediate states
 * unreachable — you cannot type "0.5" if "0" is immediately coerced and
 * re-rendered, and clearing the field snaps it back to 0. Parsing happens
 * once, in the ranking memo.
 */
type Item = {
  id: string;
  label: string;
  price: string;
  qty: string;
  unit: string;
};

type ValueConfig = {
  items: Item[];
  family: FamilyKey;
  currency: string;
};

const newId = () => Math.random().toString(36).slice(2, 9);

const EASE: [number, number, number, number] = [0.22, 0.9, 0.28, 1];

/*
 * Default ids are fixed strings. This module is evaluated once on the server
 * and again in the browser, so `newId()` here gave the same rows different
 * ids on each side of hydration.
 */
const DEFAULT: ValueConfig = {
  family: "weight",
  currency: "₹",
  items: [
    { id: "d1", label: "Small pack", price: "10", qty: "30", unit: "g" },
    { id: "d2", label: "Medium pack", price: "15", qty: "60", unit: "g" },
    { id: "d3", label: "Large pack", price: "25", qty: "90", unit: "g" },
  ],
};

/** Labels of the brand-specific example rows earlier versions shipped with. */
const OLD_EXAMPLE_LABELS = ["Maggi 30g", "Maggi 60g", "Maggi 90g"];

/*
 * Stored configs are trusted only as far as their shape. An unknown family
 * key would make `FAMILIES[cfg.family]` undefined and crash the first render,
 * and a row missing a field would crash `.trim()` in the ranking memo.
 */
function normalize(c: ValueConfig): ValueConfig {
  // Untouched old example rows are swapped for the generic ones; anything the
  // user edited is kept as-is.
  if (
    Array.isArray(c.items) &&
    c.items.length === OLD_EXAMPLE_LABELS.length &&
    c.items.every((it, i) => it?.label === OLD_EXAMPLE_LABELS[i])
  ) {
    c = { ...c, items: DEFAULT.items };
  }
  const family = (Object.keys(FAMILIES) as FamilyKey[]).includes(c.family)
    ? c.family
    : DEFAULT.family;
  const items = Array.isArray(c.items)
    ? c.items.map((it) => ({
        id: typeof it?.id === "string" ? it.id : newId(),
        label: String(it?.label ?? ""),
        price: String(it?.price ?? ""),
        qty: String(it?.qty ?? ""),
        unit: String(it?.unit ?? ""),
      }))
    : DEFAULT.items;
  const currency = typeof c.currency === "string" ? c.currency : DEFAULT.currency;
  return { family, currency, items };
}

export default function ValueEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<ValueConfig>(DEFAULT);
  /* The exact verdict text last saved, so the same verdict can't be saved twice. */
  const [saved, setSaved] = useState<{ id: string; text: string } | null>(null);
  const savedTimer = useRef<number | null>(null);

  useEffect(() => {
    setCfg(normalize(readConfig<ValueConfig>(engine.slug, DEFAULT)));
  }, [engine.slug]);

  useEffect(
    () => () => {
      if (savedTimer.current !== null) clearTimeout(savedTimer.current);
    },
    [],
  );

  const persist = (next: ValueConfig) => {
    setCfg(next);
    writeConfig(engine.slug, next);
  };

  const family = FAMILIES[cfg.family];

  /*
   * The whole comparison is one derived value. It re-runs on any edit, which
   * is a keystroke-frequency event, so it stays a single O(n) pass with no
   * allocation per row beyond the result objects themselves.
   */
  const ranked = useMemo(() => {
    const fam = FAMILIES[cfg.family];

    const rows = cfg.items.map((it) => {
      const unit =
        fam.units.find((u) => u.key === it.unit) ??
        fam.units.find((u) => u.key === fam.base)!;
      const price = parseFloat(it.price);
      const qty = parseFloat(it.qty);
      // A row only competes if it has a real price and a real quantity.
      // Anything else (blank, zero, negative, NaN) is shown but not ranked,
      // which also keeps the division below safe.
      const valid =
        Number.isFinite(price) &&
        Number.isFinite(qty) &&
        price > 0 &&
        qty > 0;
      const baseQty = valid ? qty * unit.factor : 0;
      const perBase = valid ? price / baseQty : Number.POSITIVE_INFINITY;
      return {
        id: it.id,
        label: it.label.trim() || "Untitled",
        price,
        qty,
        unitLabel: unit.label,
        baseQty,
        perBase,
        perDisplay: perBase * fam.display.factor,
        valid,
      };
    });

    const competing = rows.filter((r) => r.valid);
    const best = competing.length
      ? Math.min(...competing.map((r) => r.perBase))
      : 0;
    const worst = competing.length
      ? Math.max(...competing.map((r) => r.perBase))
      : 0;

    // Cheapest first; unrankable rows sink to the bottom (Infinity sorts last).
    const sorted = [...rows].sort((a, b) => a.perBase - b.perBase);

    return {
      rows: sorted,
      best,
      worst,
      winner: competing.length ? sorted[0] : null,
      competing: competing.length,
      /* How much the best option undercuts the worst, as a percentage. */
      spreadPct: worst > 0 && competing.length > 1 ? (1 - best / worst) * 100 : 0,
    };
  }, [cfg.items, cfg.family]);

  const setItem = (id: string, patch: Partial<Item>) => {
    persist({
      ...cfg,
      items: cfg.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    });
  };

  const addItem = () => {
    persist({
      ...cfg,
      items: [
        ...cfg.items,
        {
          id: newId(),
          label: `Option ${cfg.items.length + 1}`,
          price: "",
          qty: "",
          unit: family.base,
        },
      ],
    });
  };

  const removeItem = (id: string) => {
    persist({ ...cfg, items: cfg.items.filter((i) => i.id !== id) });
  };

  const setFamily = (key: FamilyKey) => {
    if (key === cfg.family) return;
    // Units are family-scoped, so carrying "kg" into Volume would be
    // meaningless. Each row moves to the unit worth the same number of base
    // units (kg -> L, g -> ml), falling back to the base unit. Resetting
    // everything to the base unit turned "1 kg vs 500 g" into "1 ml vs
    // 500 ml" — the classic fix-the-family-after-typing flow silently
    // inverted the verdict.
    const from = FAMILIES[cfg.family];
    const to = FAMILIES[key];
    persist({
      ...cfg,
      family: key,
      items: cfg.items.map((i) => {
        const factor = from.units.find((u) => u.key === i.unit)?.factor ?? 1;
        const unit =
          to.units.find((u) => u.factor === factor) ??
          to.units.find((u) => u.key === to.base) ??
          to.units[0];
        return { ...i, unit: unit.key };
      }),
    });
  };

  const verdict = ranked.winner
    ? `${ranked.winner.label} — ${money(ranked.winner.perDisplay, cfg.currency)}/${family.display.label}`
    : null;
  /* "Saved" only while the verdict on screen is the one that was saved; any
     edit that changes it re-arms the button immediately. */
  const isSaved = saved !== null && saved.text === verdict;

  const saveVerdict = () => {
    const w = ranked.winner;
    if (!w || !verdict || isSaved) return;
    pushHistory({
      engineId: engine.slug,
      outcome: verdict,
      meta: { comparedAgainst: ranked.competing },
    });
    setSaved({ id: w.id, text: verdict });
    if (savedTimer.current !== null) clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaved(null), 1600);
  };

  return (
    <EngineShell
      engine={engine}
      variant="aurora"
      side={
        <>
          <SidePanel title="Items">
            <div className="max-h-[26rem] overflow-y-auto pr-1">
              <ul className="space-y-2">
                {cfg.items.map((it) => (
                  <li
                    key={it.id}
                    className="group rounded-xl bg-white/5 p-2.5 ring-1 ring-white/10"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        value={it.label}
                        onChange={(e) =>
                          setItem(it.id, { label: e.target.value.slice(0, 32) })
                        }
                        placeholder="Name"
                        aria-label="Item name"
                        className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-1 text-sm text-white outline-none placeholder:text-white/30"
                      />
                      {/* Hidden until hover only where hover exists — on a
                          touch screen there is no hover, so the delete
                          button was invisible (though still tappable). */}
                      <button
                        onClick={() => removeItem(it.id)}
                        aria-label={`Remove ${it.label || "item"}`}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/40 transition-all hover:bg-red-500/10 hover:text-red-300 focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex flex-1 items-center gap-1 rounded-lg bg-white/5 px-2 py-1 ring-1 ring-white/10">
                        <span className="text-xs text-white/40">
                          {cfg.currency}
                        </span>
                        <input
                          value={it.price}
                          onChange={(e) =>
                            setItem(it.id, { price: sanitize(e.target.value) })
                          }
                          inputMode="decimal"
                          placeholder="Price"
                          aria-label={`Price of ${it.label || "item"}`}
                          className="w-full min-w-0 bg-transparent text-right text-sm tabular-nums text-white outline-none placeholder:text-white/30"
                        />
                      </div>
                      <span className="text-xs text-white/30">for</span>
                      <div className="flex flex-1 items-center gap-1 rounded-lg bg-white/5 px-2 py-1 ring-1 ring-white/10">
                        <input
                          value={it.qty}
                          onChange={(e) =>
                            setItem(it.id, { qty: sanitize(e.target.value) })
                          }
                          inputMode="decimal"
                          placeholder="Qty"
                          aria-label={`Quantity of ${it.label || "item"}`}
                          className="w-full min-w-0 bg-transparent text-right text-sm tabular-nums text-white outline-none placeholder:text-white/30"
                        />
                        <select
                          value={it.unit}
                          onChange={(e) =>
                            setItem(it.id, { unit: e.target.value })
                          }
                          aria-label={`Unit for ${it.label || "item"}`}
                          className="shrink-0 bg-transparent text-xs text-white/60 outline-none"
                        >
                          {family.units.map((u) => (
                            <option
                              key={u.key}
                              value={u.key}
                              className="bg-ink-950 text-white"
                            >
                              {u.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={addItem}
              className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-xl bg-white/5 px-3 py-2 text-xs font-medium text-white ring-1 ring-white/10 hover:bg-white/10"
            >
              <Plus className="h-3.5 w-3.5" /> Add item
            </button>
          </SidePanel>

          <SidePanel title="Measured in">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(FAMILIES) as FamilyKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setFamily(k)}
                  className={
                    "rounded-xl px-3 py-2 text-xs font-medium transition-all " +
                    (cfg.family === k
                      ? "bg-white text-ink-950 shadow-glow"
                      : "bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white")
                  }
                >
                  {FAMILIES[k].name}
                </button>
              ))}
            </div>
          </SidePanel>

          <SidePanel title="Currency">
            <div className="flex flex-wrap gap-2">
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  onClick={() => persist({ ...cfg, currency: c })}
                  className={
                    "h-9 w-9 rounded-xl text-sm font-semibold transition-all " +
                    (cfg.currency === c
                      ? "bg-white text-ink-950 shadow-glow"
                      : "bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white")
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </SidePanel>
        </>
      }
    >
      <div className="flex h-full flex-col justify-between gap-8">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-white/40">
            Cost per {family.display.label}
          </p>
        </div>

        {ranked.competing === 0 ? (
          <div className="grid flex-1 place-items-center text-center text-white/45">
            <div>
              <div className="text-5xl">🏷️</div>
              <p className="mt-4 text-sm">
                Add a price and a quantity to start comparing.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-8">
            {/* Verdict */}
            {/*
              Keyed on the winner alone. Keying on `id + perBase` remounted
              the verdict on every keystroke in the winner's price or
              quantity, so while you typed it blinked to transparent and
              faded back in once per character. Now it re-enters only when a
              different option takes the lead; edits just update the text.
            */}
            <AnimatePresence mode="wait">
              {ranked.winner && (
                <motion.div
                  key={ranked.winner.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="text-center"
                >
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300 ring-1 ring-emerald-400/25">
                    <Crown className="h-3.5 w-3.5" />
                    Best value
                  </div>
                  <p className="mt-3 break-words text-4xl font-semibold tracking-tight text-white">
                    {ranked.winner.label}
                  </p>
                  <p className="mt-2 text-lg tabular-nums text-white/70">
                    {money(ranked.winner.perDisplay, cfg.currency)}
                    <span className="text-white/40">
                      {" "}
                      / {family.display.label}
                    </span>
                  </p>
                  {ranked.spreadPct > 0.05 && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-emerald-300/90">
                      <TrendingDown className="h-4 w-4" />
                      {ranked.spreadPct.toFixed(1)}% cheaper than the worst
                      option here
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Ranking */}
            <ul className="flex flex-col gap-2.5">
              {ranked.rows.map((r, i) => (
                <RankRow
                  key={r.id}
                  row={r}
                  rank={i + 1}
                  best={ranked.best}
                  worst={ranked.worst}
                  currency={cfg.currency}
                  displayLabel={family.display.label}
                  baseUnit={family.base}
                  justSaved={isSaved && saved?.id === r.id}
                />
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col items-center gap-3">
          <BigActionButton
            label={isSaved ? "Saved to history" : "Save this verdict"}
            onClick={saveVerdict}
            disabled={!ranked.winner}
            color="#10b981"
            color2="#f59e0b"
          />
          {ranked.competing === 1 && (
            <p className="text-xs text-white/40">
              Add a second item to see a comparison.
            </p>
          )}
        </div>
      </div>
    </EngineShell>
  );
}

type Row = {
  id: string;
  label: string;
  qty: number;
  unitLabel: string;
  price: number;
  perBase: number;
  perDisplay: number;
  valid: boolean;
};

function RankRow({
  row,
  rank,
  best,
  worst,
  currency,
  displayLabel,
  baseUnit,
  justSaved,
}: {
  row: Row;
  rank: number;
  best: number;
  worst: number;
  currency: string;
  displayLabel: string;
  baseUnit: string;
  justSaved: boolean;
}) {
  /*
   * Rows re-sort as you type. `layout="position"` glides a row to its new
   * rank (a transform, measured once per edit) instead of teleporting there
   * while its cost bar is still easing — which read as the bars jumping.
   * Position-only, so the bar and text inside are never scale-distorted.
   */
  if (!row.valid) {
    return (
      <motion.li
        layout="position"
        transition={{ duration: 0.35, ease: EASE }}
        className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.03] px-4 py-3 text-sm text-white/35 ring-1 ring-white/5"
      >
        <span className="truncate">{row.label}</span>
        <span className="shrink-0 text-xs">needs a price and quantity</span>
      </motion.li>
    );
  }

  /* Equal unit prices can differ in the last float bit (they're computed
     through different unit factors); a true tie should read as a tie. */
  const isBest = row.perBase <= best * (1 + 1e-9);
  /* The fraction the whole tool exists to surface: how this option's unit
     price compares to the cheapest one. 1.00x is the winner. */
  const ratio = best > 0 ? row.perBase / best : 1;
  const premiumPct = (ratio - 1) * 100;
  /* Bar length is relative to the most expensive option, so the spread is
     legible even when every option is within a few percent. */
  const fill = worst > 0 ? row.perBase / worst : 1;

  return (
    <motion.li
      layout="position"
      transition={{ duration: 0.35, ease: EASE }}
      className={
        "relative overflow-hidden rounded-2xl px-4 py-3 ring-1 transition-colors " +
        (isBest
          ? "bg-emerald-400/[0.07] ring-emerald-400/30"
          : "bg-white/[0.03] ring-white/10")
      }
    >
      {/* Relative-cost bar. Scaled with transform rather than width so the
          browser composites it instead of re-running layout on every edit. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-full origin-left"
        style={{
          background: isBest
            ? "linear-gradient(90deg, rgba(16,185,129,0.20), rgba(16,185,129,0.04))"
            : "linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.01))",
        }}
        initial={false}
        animate={{ scaleX: fill }}
        transition={{ duration: 0.45, ease: EASE }}
      />

      <div className="relative flex items-center gap-3">
        <span
          className={
            "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums " +
            (isBest ? "bg-emerald-400 text-ink-950" : "bg-white/10 text-white/60")
          }
        >
          {rank}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">
            {row.label}
            {justSaved && (
              <span className="ml-2 text-[10px] uppercase tracking-widest text-emerald-300">
                saved
              </span>
            )}
          </p>
          <p className="text-[11px] tabular-nums text-white/40">
            {money(row.price, currency)} for {trim(row.qty)} {row.unitLabel}
            {" · "}
            {money(row.perBase, currency)}/{baseUnit}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-white">
            {money(row.perDisplay, currency)}
          </p>
          <p className="text-[11px] tabular-nums text-white/40">
            / {displayLabel}
          </p>
        </div>

        <div className="w-16 shrink-0 text-right">
          {isBest ? (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
              best
            </span>
          ) : (
            <>
              <p className="text-sm font-semibold tabular-nums text-amber-300/90">
                +{premiumPct.toFixed(0)}%
              </p>
              <p className="text-[11px] tabular-nums text-white/35">
                {ratio.toFixed(2)}×
              </p>
            </>
          )}
        </div>
      </div>
    </motion.li>
  );
}

/* ---------------- helpers ---------------- */

/** Keep numeric fields to digits and a single decimal point while typing. */
function sanitize(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  return parts.length <= 2
    ? cleaned
    : `${parts[0]}.${parts.slice(1).join("")}`;
}

/**
 * Unit prices span a wide range — ₹120/kg and ₹0.0083/ml can appear in the
 * same session — so precision follows magnitude instead of being fixed.
 */
function money(n: number, currency: string) {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const digits = abs >= 100 ? 0 : abs >= 1 ? 2 : abs >= 0.01 ? 3 : 4;
  return `${currency}${n.toFixed(digits)}`;
}

/** 30 -> "30", 1.5 -> "1.5" (no trailing zeroes on whole numbers). */
function trim(n: number) {
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(3)));
}
