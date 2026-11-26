
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

export interface Velocity {
  x: number;
  y: number;
}

export function smoothVelocity(smooth: Velocity, step: Velocity, k: number, scale: number): Velocity {
  const opposes = smooth.x * step.x + smooth.y * step.y < 0;
  if (opposes && Math.hypot(step.x, step.y) > 1) return { x: step.x, y: step.y };
  const e = easeFactor(k, scale);
  return { x: smooth.x + (step.x - smooth.x) * e, y: smooth.y + (step.y - smooth.y) * e };
}
