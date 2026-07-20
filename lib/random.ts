export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickWeighted<T>(arr: { value: T; weight: number }[]): T {
  const total = arr.reduce((s, i) => s + Math.max(0, i.weight), 0);
  if (total <= 0) return pick(arr).value;
  let r = Math.random() * total;
  for (const item of arr) {
    r -= Math.max(0, item.weight);
    if (r <= 0) return item.value;
  }
  return arr[arr.length - 1].value;
}

export function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
