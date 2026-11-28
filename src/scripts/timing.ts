export const REFERENCE_FRAME_MS = 1000 / 60;
const MAX_ELAPSED_MS = 100;

export function frameScale(elapsedMs: number): number {
  if (!(elapsedMs > 0)) return 0;
  return Math.min(elapsedMs, MAX_ELAPSED_MS) / REFERENCE_FRAME_MS;
}

export function easeFactor(k: number, scale: number): number {
  return 1 - Math.pow(1 - k, scale);
}

export function decayFactor(perFrame: number, scale: number): number {
  return Math.pow(perFrame, scale);
}
