// seed から決まる乱数（mulberry32）。状態を引数で受け取り、新しい状態を返す

export interface RandomStep {
  value: number; // 0 以上 1 未満
  seed: number;
}

export function nextRandom(seed: number): RandomStep {
  const next = (seed + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, seed: next };
}

/** 0 以上 n 未満の整数 */
export function nextInt(seed: number, n: number): { value: number; seed: number } {
  const step = nextRandom(seed);
  return { value: Math.floor(step.value * n), seed: step.seed };
}
