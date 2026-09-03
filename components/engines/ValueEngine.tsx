"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
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

type FamilyKey = "weight" | "volume" | "count";

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
      { key: "g", label: "g", factor: 1 },
      { key: "kg", label: "kg", factor: 1000 },
    ],
    display: { label: "100 g", factor: 100 },
  },
  volume: {
    name: "Volume",
    base: "ml",
    units: [
      { key: "ml", label: "ml", factor: 1 },
      { key: "L", label: "L", factor: 1000 },
    ],
    display: { label: "100 ml", factor: 100 },
  },
  count: {
    name: "Count",
    base: "pc",
    units: [
      { key: "pc", label: "pc", factor: 1 },
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

const DEFAULT: ValueConfig = {
  family: "weight",
  currency: "₹",
  items: [
    { id: newId(), label: "Maggi 30g", price: "10", qty: "30", unit: "g" },
    { id: newId(), label: "Maggi 60g", price: "15", qty: "60", unit: "g" },
    { id: newId(), label: "Maggi 90g", price: "25", qty: "90", unit: "g" },
  ],
};

export default function ValueEngine({ engine }: { engine: EngineDef }) {
  const [cfg, setCfg] = useState<ValueConfig>(DEFAULT);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    setCfg(readConfig<ValueConfig>(engine.slug, DEFAULT));
  }, [engine.slug]);

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
        fam.units.find((u) => u.key === it.unit) ?? fam.units[0];
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
          unit: family.units[0].key,
        },
      ],
    });
  };

  const removeItem = (id: string) => {
    persist({ ...cfg, items: cfg.items.filter((i) => i.id !== id) });
  };

  const setFamily = (key: FamilyKey) => {
    // Units are family-scoped, so carrying "kg" into Volume would be
    // meaningless. Reset every row to the new family's base unit.
    const base = FAMILIES[key].units[0].key;
    persist({
      ...cfg,
      family: key,
      items: cfg.items.map((i) => ({ ...i, unit: base })),
    });
  };

  const saveVerdict = () => {
    const w = ranked.winner;
    if (!w) return;
    const text = `${w.label} — ${money(w.perDisplay, cfg.currency)}/${family.display.label}`;
    pushHistory({
      engineId: engine.slug,
      outcome: text,
      meta: { comparedAgainst: ranked.competing },
    });
    setSaved(w.id);
    window.setTimeout(() => setSaved(null), 1600);
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
                        className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-1 text-sm text-white outline-none placeholder:text-white/30"
                      />
                      <button
                        onClick={() => removeItem(it.id)}
                        aria-label={`Remove ${it.label || "item"}`}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/40 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-300 focus-visible:opacity-100 group-hover:opacity-100"
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
                          aria-label="Price"
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
                          aria-label="Quantity"
                          className="w-full min-w-0 bg-transparent text-right text-sm tabular-nums text-white outline-none placeholder:text-white/30"
                        />
                        <select
                          value={it.unit}
                          onChange={(e) =>
                            setItem(it.id, { unit: e.target.value })
                          }
                          aria-label="Unit"
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
            <div className="grid grid-cols-3 gap-2">
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
            <AnimatePresence mode="wait">
              {ranked.winner && (
                <motion.div
                  key={ranked.winner.id + ranked.winner.perBase}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 0.9, 0.28, 1] }}
                  className="text-center"
                >
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300 ring-1 ring-emerald-400/25">
                    <Crown className="h-3.5 w-3.5" />
                    Best value
                  </div>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-white">
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
                  justSaved={saved === r.id}
                />
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col items-center gap-3">
          <BigActionButton
            label={saved ? "Saved to history" : "Save this verdict"}
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
  if (!row.valid) {
    return (
      <li className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3 text-sm text-white/35 ring-1 ring-white/5">
        <span className="truncate">{row.label}</span>
        <span className="text-xs">needs a price and quantity</span>
      </li>
    );
  }

  const isBest = row.perBase === best;
  /* The fraction the whole tool exists to surface: how this option's unit
     price compares to the cheapest one. 1.00x is the winner. */
  const ratio = best > 0 ? row.perBase / best : 1;
  const premiumPct = (ratio - 1) * 100;
  /* Bar length is relative to the most expensive option, so the spread is
     legible even when every option is within a few percent. */
  const fill = worst > 0 ? row.perBase / worst : 1;

  return (
    <li
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
        transition={{ duration: 0.45, ease: [0.22, 0.9, 0.28, 1] }}
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
    </li>
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
