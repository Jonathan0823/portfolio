export function levelForValue(value: number, jitter: number): number {
  const level = Math.floor((value + jitter * 0.06) * 6);
  return Math.max(0, Math.min(5, level));
}
