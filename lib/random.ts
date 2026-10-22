export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Weighted pick. Items with a zero, negative or non-finite weight can never be
 * chosen (unless every weight is unusable, in which case it's a uniform pick).
 *
 * The comparison is strict: with `r <= 0`, a Math.random() of exactly 0 let
 * the first item win even when its weight was 0.
 */
export function pickWeighted<T>(arr: { value: T; weight: number }[]): T {
  const usable = arr.filter((i) => Number.isFinite(i.weight) && i.weight > 0);
  if (usable.length === 0) return pick(arr).value;
  const total = usable.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of usable) {
    r -= item.weight;
    if (r < 0) return item.value;
  }
  // Floating-point leftovers land on the last item that could actually win.
  return usable[usable.length - 1].value;
}

/**
 * Round trig-derived geometry before it goes into markup. Node and the browser
 * can disagree on the last bit of Math.sin/Math.cos, which turned server-
 * rendered SVG paths and seat positions into hydration mismatches.
 */
export function stable(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

export function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
